const express = require("express");
const app = express.Router();
const config = require("../Config/config.json");
const functions = require("../structs/functions.js");
const log = require("../structs/log.js");
const MMCode = require("../model/mmcodes.js");
const { verifyToken } = require("../tokenManager/tokenVerify.js");
const qs = require("qs");
const error = require("../structs/error.js");

let buildUniqueId = {};

app.get("/fortnite/api/matchmaking/session/findPlayer/*", (req, res) => {
    log.debug("GET /fortnite/api/matchmaking/session/findPlayer/* called");
    res.status(200);
    res.end();
});

app.get("/*/api/game/v2/matchmakingservice/ticket/player/*", verifyToken, async (req, res) => {
    log.debug("GET /*/api/game/v2/matchmakingservice/ticket/player/* called");
    if (req.user.isServer == true) return res.status(403).end();
    if (req.user.matchmakingId == null) return res.status(400).end();
 
    const playerCustomKey = qs.parse(req.url.split("?")[1], { ignoreQueryPrefix: true })['player.option.customKey'];
    const bucketId = qs.parse(req.url.split("?")[1], { ignoreQueryPrefix: true })['bucketId'];
 
 
    const decodedBucketId = decodeURIComponent(bucketId);
 
    if (typeof decodedBucketId !== "string" || decodedBucketId.split(":").length !== 4) {
        console.log("[Debug] Invalid bucketId format:", decodedBucketId);
        return res.status(400).end();
    }
 
    const rawPlaylistId = decodedBucketId.split(":")[3];
    let playlistId = rawPlaylistId;
 
    if (!playlistId || playlistId.trim() === '') {
        console.log("[Debug] PlaylistId is empty or invalid");
        return error.createError("errors.com.epicgames.common.matchmaking.playlist.not_found", `Invalid playlist ID: ${playlistId}`, [], 1013, "invalid_playlist", 404, res);
    }
 
    const gameServers = config.gameServerIP;
    let selectedServer = gameServers.find(server => server.split(":")[2] === playlistId);
    if (!selectedServer) {
        log.debug("No server found for playlist ID", playlistId);
        return error.createError("errors.com.epicgames.common.matchmaking.playlist.not_found", `No server found for playlist ID ${playlistId}`, [], 1013, "invalid_playlist", 404, res);
    }
 
    await global.kv.set(`playerPlaylist:${req.user.accountId}`, playlistId);
 
    if (!global.matchmakingTickets) {
        global.matchmakingTickets = {};
    }
 
    const ticketData = {
        playlistId: playlistId,
        region: 'EU',
        accountId: req.user.accountId,
        matchmakingId: req.user.matchmakingId,
        timestamp: Date.now()
    };
 
    global.matchmakingTickets[req.user.accountId] = ticketData;
    global.matchmakingTickets[`mm_${req.user.matchmakingId}`] = ticketData;
 
    if (typeof playerCustomKey == "string") {
        let codeDocument = await MMCode.findOne({ code_lower: playerCustomKey?.toLowerCase() });
        if (!codeDocument) {
            return error.createError("errors.com.epicgames.common.matchmaking.code.not_found", `The matchmaking code "${playerCustomKey}" was not found`, [], 1013, "invalid_code", 404, res);
        }
        const kvDocument = JSON.stringify({
            ip: codeDocument.ip,
            port: codeDocument.port,
            playlistId: playlistId,
        });
        await global.kv.set(`playerCustomKey:${req.user.accountId}`, kvDocument);
    }
 
    const queryBucketId = qs.parse(req.url.split("?")[1], { ignoreQueryPrefix: true })['bucketId'];
 
    const decodedQueryBucketId = decodeURIComponent(queryBucketId);
    if (typeof decodedQueryBucketId !== "string" || decodedQueryBucketId.split(":").length !== 4) {
        return res.status(400).end();
    }
 
    buildUniqueId[req.user.accountId] = decodedQueryBucketId.split(":")[0];
 
    const matchmakerIP = config.matchmakerIP;
 
    let wsUrl;
    if (!matchmakerIP) {
        console.error("[Error] MatchmakerIP is not configured!");
        return res.status(500).json({ error: "Matchmaker not configured" });
    }
 
    let cleanMatchmakerIP = String(matchmakerIP).trim().replace(/\/+$/, '');
 
    if (!cleanMatchmakerIP.startsWith('ws://') && !cleanMatchmakerIP.startsWith('wss://')) {
        wsUrl = `ws://${cleanMatchmakerIP}`;
    } else {
        wsUrl = cleanMatchmakerIP;
    }
 
    const queryParams = new URLSearchParams({
        playlistId: playlistId,
        region: 'EU',
        accountId: req.user.accountId,
        matchmakingId: req.user.matchmakingId
    });
 
    wsUrl += `?${queryParams.toString()}`;
 
    try {
        const urlTest = new URL(wsUrl);
        if (!urlTest.searchParams.get('playlistId')) {
            throw new Error('PlaylistId missing from URL');
        }
    } catch (urlError) {
        console.error("[Error] Invalid WebSocket URL generated:", wsUrl, urlError);
        return res.status(500).json({ error: "Invalid matchmaker URL configuration" });
    }
 
    return res.json({
        "serviceUrl": wsUrl,
        "ticketType": "mms-player", 
        "payload": `${req.user.matchmakingId}`,
        "signature": "account",
        "playlistId": playlistId,
    });
});

app.get("/fortnite/api/game/v2/matchmaking/account/:accountId/session/:sessionId", (req, res) => {
    log.debug(`GET /fortnite/api/game/v2/matchmaking/account/${req.params.accountId}/session/${req.params.sessionId} called`);
    res.json({
        "accountId": req.params.accountId,
        "sessionId": req.params.sessionId,
        "key": "none"
    });
});

app.get("/fortnite/api/matchmaking/session/:sessionId", verifyToken, async (req, res) => {
    log.debug(`GET /fortnite/api/matchmaking/session/${req.params.sessionId} called`);
    const playlist = await global.kv.get(`playerPlaylist:${req.user.accountId}`);
    let kvDocument = await global.kv.get(`playerCustomKey:${req.user.accountId}`);
    if (!kvDocument) {
        const gameServers = config.gameServerIP;
        let selectedServer = gameServers.find(server => server.split(":")[2] === playlist);
        if (!selectedServer) {
            log.debug("No server found for playlist", playlist);
            return error.createError("errors.com.epicgames.common.matchmaking.playlist.not_found", `No server found for playlist ${playlist}`, [], 1013, "invalid_playlist", 404, res);
        }
        kvDocument = JSON.stringify({
            ip: selectedServer.split(":")[0],
            port: selectedServer.split(":")[1],
            playlist: selectedServer.split(":")[2]
        });
    }
    let codeKV = JSON.parse(kvDocument);

    res.json({
        "id": req.params.sessionId,
        "ownerId": functions.MakeID().replace(/-/ig, "").toUpperCase(),
        "ownerName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverAddress": codeKV.ip,
        "serverPort": codeKV.port,
        "maxPublicPlayers": 220,
        "openPublicPlayers": 175,
        "maxPrivatePlayers": 0,
        "openPrivatePlayers": 0,
        "attributes": {
          "REGION_s": "EU",
          "GAMEMODE_s": "FORTATHENA",
          "ALLOWBROADCASTING_b": true,
          "SUBREGION_s": "GB",
          "DCID_s": "FORTNITE-LIVEEUGCEC1C2E30UBRCORE0A-14840880",
          "tenant_s": "Fortnite",
          "MATCHMAKINGPOOL_s": "Any",
          "STORMSHIELDDEFENSETYPE_i": 0,
          "HOTFIXVERSION_i": 0,
          "PLAYLISTNAME_s": codeKV.playlist,
          "SESSIONKEY_s": functions.MakeID().replace(/-/ig, "").toUpperCase(),
          "TENANT_s": "Fortnite",
          "BEACONPORT_i": 15009
        },
        "publicPlayers": [],
        "privatePlayers": [],
        "totalPlayers": 45,
        "allowJoinInProgress": false,
        "shouldAdvertise": false,
        "isDedicated": false,
        "usesStats": false,
        "allowInvites": false,
        "usesPresence": false,
        "allowJoinViaPresence": true,
        "allowJoinViaPresenceFriendsOnly": false,
        "buildUniqueId": buildUniqueId[req.user.accountId] || "0",
        "lastUpdated": new Date().toISOString(),
        "started": false
      });
});

app.post("/fortnite/api/matchmaking/session/*/join", (req, res) => {
    log.debug("POST /fortnite/api/matchmaking/session/*/join called");
    res.status(204);
    res.end();
});

app.post("/fortnite/api/matchmaking/session/matchMakingRequest", (req, res) => {
    log.debug("POST /fortnite/api/matchmaking/session/matchMakingRequest called");
    res.json([]);
});

module.exports = app;