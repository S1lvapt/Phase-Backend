const express = require("express");
const app = express.Router();

const Friends = require("../model/friends.js");
const friendManager = require("../structs/friend.js");
const functions = require("../structs/functions.js");
const log = require("../structs/log.js");
const { verifyToken } = require("../tokenManager/tokenVerify.js");

app.get("/friends/api/v1/*/settings", (req, res) => {
    res.json({});
});

app.get("/friends/api/v1/*/blocklist", (req, res) => {
    res.json([]);
});

app.get("/friends/api/public/list/fortnite/*/recentPlayers", (req, res) => {
    res.json([]);
});

app.get("/fortnite/api/game/v2/friendcodes/:accountId/epic", (req, res) => {
    log.debug(`GET /fortnite/api/game/v2/friendcodes/${req.params.accountId}/epic called`);
    res.json([]);
});

app.all("/friends/api/v1/*/friends/:friendId/alias", verifyToken, async (req, res) => {
    res.status(204).end();
});

app.post("/friends/api/*/friends/:receiverId", verifyToken, async (req, res) => {
    const sender = await Friends.findOne({ accountId: req.user.accountId });
    const receiver = await Friends.findOne({ accountId: req.params.receiverId });
    if (!sender || !receiver) return res.status(403).end();

    if (sender.list.incoming.find(i => i.accountId == receiver.accountId)) {
        if (!await friendManager.acceptFriendReq(sender.accountId, receiver.accountId)) return res.status(403).end();
    } else if (!sender.list.outgoing.find(i => i.accountId == receiver.accountId)) {
        if (!await friendManager.sendFriendReq(sender.accountId, receiver.accountId)) return res.status(403).end();
    }

    res.status(204).end();
});

app.delete("/friends/api/*/friends/:receiverId", verifyToken, async (req, res) => {
    const sender = await Friends.findOne({ accountId: req.user.accountId });
    const receiver = await Friends.findOne({ accountId: req.params.receiverId });
    if (!sender || !receiver) return res.status(403).end();

    if (!await friendManager.deleteFriend(sender.accountId, receiver.accountId)) return res.status(403).end();

    res.status(204).end();
});

app.post("/friends/api/*/blocklist/:receiverId", verifyToken, async (req, res) => {
    const sender = await Friends.findOne({ accountId: req.user.accountId });
    const receiver = await Friends.findOne({ accountId: req.params.receiverId });
    if (!sender || !receiver) return res.status(403).end();

    if (!await friendManager.blockFriend(sender.accountId, receiver.accountId)) return res.status(403).end();

    res.status(204).end();
});

app.delete("/friends/api/*/blocklist/:receiverId", verifyToken, async (req, res) => {
    const sender = await Friends.findOne({ accountId: req.user.accountId });
    const receiver = await Friends.findOne({ accountId: req.params.receiverId });
    if (!sender || !receiver) return res.status(403).end();

    if (!await friendManager.deleteFriend(sender.accountId, receiver.accountId)) return res.status(403).end();

    res.status(204).end();
});

app.get("/friends/api/v1/:accountId/summary", verifyToken, async (req, res) => {
    const response = {
        "friends": [],
        "incoming": [],
        "outgoing": [],
        "suggested": [],
        "blocklist": [],
        "settings": {
            "acceptInvites": "public"
        }
    };

    const friends = await Friends.findOne({ accountId: req.user.accountId }).lean();
    if (!friends) return res.json(response);

    friends.list.accepted.forEach(acceptedFriend => {
        response.friends.push({
            "accountId": acceptedFriend.accountId,
            "groups": [],
            "mutual": 0,
            "alias": acceptedFriend.alias || "",
            "note": "",
            "favorite": false,
            "created": acceptedFriend.created
        });
    });

    friends.list.incoming.forEach(incomingFriend => {
        response.incoming.push({
            "accountId": incomingFriend.accountId,
            "mutual": 0,
            "favorite": false,
            "created": incomingFriend.created
        });
    });

    friends.list.outgoing.forEach(outgoingFriend => {
        response.outgoing.push({
            "accountId": outgoingFriend.accountId,
            "favorite": false
        });
    });

    friends.list.blocked.forEach(blockedFriend => {
        response.blocklist.push({
            "accountId": blockedFriend.accountId
        });
    });

    res.json(response);
});

app.get("/friends/api/public/blocklist/*", verifyToken, async (req, res) => {
    const friends = await Friends.findOne({ accountId: req.user.accountId }).lean();
    if (!friends) return res.json({ "blockedUsers": [] });

    res.json({
        "blockedUsers": friends.list.blocked.map(i => i.accountId)
    });
});

app.get("/friends/api/public/friends/:accountId", verifyToken, async (req, res) => {
    log.debug(`GET /friends/api/public/friends/${req.params.accountId} called`);
    const friends = await Friends.findOne({ accountId: req.params.accountId }).lean();
    if (!friends) return res.json([]);

    const includePending = req.query.includePending === "true";
    const response = [];

    friends.list.accepted.forEach(f => {
        response.push({
            "accountId": f.accountId,
            "status": "ACCEPTED",
            "direction": "OUTBOUND",
            "created": f.created,
            "favorite": false
        });
    });

    if (includePending) {
        friends.list.incoming.forEach(f => {
            response.push({
                "accountId": f.accountId,
                "status": "PENDING",
                "direction": "INBOUND",
                "created": f.created,
                "favorite": false
            });
        });

        friends.list.outgoing.forEach(f => {
            response.push({
                "accountId": f.accountId,
                "status": "PENDING",
                "direction": "OUTBOUND",
                "created": f.created || new Date().toISOString(),
                "favorite": false
            });
        });
    }

    res.json(response);
});

module.exports = app;