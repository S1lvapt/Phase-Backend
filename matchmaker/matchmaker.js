const functions = require("../structs/functions.js");
const log = require("../structs/log.js");

let queue = [];
let matchTimer = null;
let countdown = 60;

module.exports = async (ws) => {
    const ticketId = functions.MakeID().replace(/-/ig, "");
    const matchId = functions.MakeID().replace(/-/ig, "");
    const sessionId = functions.MakeID().replace(/-/ig, "");

    const player = {
        ws,
        ticketId,
        matchId,
        sessionId,
        state: "Connecting"
    };

    queue.push(player);
    log.debug(`Player joined matchmaking queue. Total: ${queue.length}`);

    if (queue.length === 1) {
        countdown = 60;
    } else {
        countdown = Math.max(0, countdown - 5);
    }

    ws.on('close', () => {
        queue = queue.filter(p => p.ws !== ws);
        log.debug(`Player left matchmaking queue. Total: ${queue.length}`);
        updateQueueConfigs();
    });

    ws.on('error', (error) => {
        log.error(`WebSocket error in matchmaking: ${error.message}`);
        queue = queue.filter(p => p.ws !== ws);
        updateQueueConfigs();
    });

    Connecting(ws);
    await functions.sleep(800);
    Waiting(ws);
    await functions.sleep(1000);

    player.state = "Queued";
    updateQueueConfigs();

    startMatchmakingTimer();
};

function updateQueueConfigs() {
    queue.forEach(player => {
        if (player.state === "Queued") {
            Queued(player.ws, player.ticketId, queue.length, countdown);
        }
    });
}

function startMatchmakingTimer() {
    if (matchTimer) return;

    matchTimer = setInterval(() => {
        if (queue.length === 0) {
            clearInterval(matchTimer);
            matchTimer = null;
            return;
        }

        if (countdown > 0) {
            countdown--;

            queue.forEach(player => {
                if (player.state === "Queued") {
                    Queued(player.ws, player.ticketId, queue.length, countdown);
                }
            });
        } else {

            const matchPlayers = [...queue];
            queue = [];
            clearInterval(matchTimer);
            matchTimer = null;

            matchPlayers.forEach(async (player) => {
                try {
                    log.debug(`Sending SessionAssignment to player ${player.matchId}`);
                    SessionAssignment(player.ws, player.matchId);
                    await functions.sleep(2000);
                    log.debug(`Sending Join message to player ${player.matchId}`);
                    Join(player.ws, player.matchId, player.sessionId);
                } catch (error) {
                    log.error(`Error sending match messages to player: ${error.message}`);
                }
            });
        }
    }, 1000);
}

function Connecting(ws) {
    ws.send(JSON.stringify({
        "payload": { "state": "Connecting" },
        "name": "StatusUpdate"
    }));
}

function Waiting(ws) {
    ws.send(JSON.stringify({
        "payload": {
            "totalPlayers": 1,
            "connectedPlayers": 1,
            "state": "Waiting"
        },
        "name": "StatusUpdate"
    }));
}

function Queued(ws, ticketId, queuedCount, estimatedWait) {
    ws.send(JSON.stringify({
        "payload": {
            "ticketId": ticketId,
            "queuedPlayers": queuedCount,
            "estimatedWaitSec": estimatedWait,
            "status": {},
            "state": "Queued"
        },
        "name": "StatusUpdate"
    }));
}

function SessionAssignment(ws, matchId) {
    ws.send(JSON.stringify({
        "payload": {
            "matchId": matchId,
            "state": "SessionAssignment"
        },
        "name": "StatusUpdate"
    }));
}

function Join(ws, matchId, sessionId) {
    ws.send(JSON.stringify({
        "payload": {
            "matchId": matchId,
            "sessionId": sessionId,
            "joinDelaySec": 1
        },
        "name": "Play"
    }));
}