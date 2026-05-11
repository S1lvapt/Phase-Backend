const express = require("express");
const app = express.Router();
const log = require("../structs/log.js");
const User = require("../model/user.js");
const Arena = require("../model/arena.js");

// Called by the game server to register itself as ready / report state
app.post("/api/gameserver/phase", (req, res) => {
    const body = req.body || {};
    log.debug(`[GameServer] POST /api/gameserver/phase - body: ${JSON.stringify(body)}`);
    return res.status(200).json({ status: "ok" });
});

// Called by the game server to report match state changes
app.post("/api/gameserver/phase/state", (req, res) => {
    const body = req.body || {};
    log.debug(`[GameServer] POST /api/gameserver/phase/state - body: ${JSON.stringify(body)}`);
    return res.status(200).json({ status: "ok" });
});

// Called by the game server to report player events (join/leave/kill/win)
app.post("/api/gameserver/phase/player", (req, res) => {
    const body = req.body || {};
    log.debug(`[GameServer] POST /api/gameserver/phase/player - body: ${JSON.stringify(body)}`);
    return res.status(200).json({ status: "ok" });
});

// /pdown - gameserver heartbeat / server status ping
app.get("/pdown", (req, res) => {
    log.debug(`[GameServer] GET /pdown`);
    return res.status(200).json({ status: "ok", online: true });
});

app.post("/pdown", (req, res) => {
    log.debug(`[GameServer] POST /pdown - body: ${JSON.stringify(req.body || {})}`);
    return res.status(200).json({ status: "ok", online: true });
});

// Called by the game server to fetch player data before allowing them to join
app.get("/api/v1/players/:game/:accountId", async (req, res) => {
    const { game, accountId } = req.params;
    const start = Date.now();
    log.debug(`[GameServer] GET /api/v1/players/${game}/${accountId}`);

    try {
        const [user, arenaData] = await Promise.all([
            User.findOne({ accountId }).lean(),
            Arena.findOne({ accountId }).lean()
        ]);

        const elapsed = Date.now() - start;

        if (!user) {
            log.debug(`[GameServer] Player ${accountId} not found (${elapsed}ms), returning guest response`);
            return res.status(200).json({
                accountId: accountId,
                displayName: accountId,
                banned: false,
                hype: 0,
                division: 0,
                tokens: ["ARENA_S24_Division1"]
            });
        }

        const hype = arenaData ? (arenaData.hype || 0) : 0;
        const division = arenaData ? (arenaData.division || 0) : 0;

        log.debug(`[GameServer] Player ${accountId} found: ${user.username}, banned: ${user.banned}, hype: ${hype} (${elapsed}ms)`);

        return res.status(200).json({
            accountId: accountId,
            displayName: user.username,
            banned: user.banned || false,
            hype: hype,
            division: division,
            tokens: [`ARENA_S24_Division${division + 1}`]
        });
    } catch (err) {
        const elapsed = Date.now() - start;
        log.error(`[GameServer] Error fetching player ${accountId} (${elapsed}ms): ${err}`);
        return res.status(200).json({
            accountId: accountId,
            displayName: accountId,
            banned: false,
            hype: 0,
            division: 0,
            tokens: ["ARENA_S24_Division1"]
        });
    }
});

module.exports = app;
