/**
 * ws_beacon_test.ts — Bun WebSocket relay server for the Waldiez Player beacon.
 *
 * Roles (automatic — no handshake needed):
 *   Broadcaster  Any client that SENDS a beacon message (the player).
 *   Listener     Any client that connects but only READS (a dashboard, script, etc.).
 *
 * The server:
 *   1. Prints every incoming beacon to the terminal.
 *   2. Relays each beacon to ALL other connected clients (so listeners see live state).
 *
 * Usage:
 *   bun scripts/ws_beacon_test.ts [--port 8765]
 *
 * Then in the player:
 *   Settings → select "Local Dev" (ws://localhost:8765) → click Beacon.
 *
 * To listen from another script:
 *   const ws = new WebSocket("ws://localhost:8765");
 *   ws.onmessage = e => console.log(JSON.parse(e.data));
 */

const PORT = parseInt(process.argv.find(a => a.startsWith("--port="))?.split("=")[1] ?? "8765");

interface BeaconMessage {
    type: "start" | "state" | "stop";
    session_id?: string;
    source?: string;
    name?: string;
    youtube_id?: string;
    playlist_id?: string;
    playing?: boolean;
    t?: number;
    duration?: number;
    volume?: number;
    muted?: boolean;
    rate?: number;
    ts?: string;
}

// All currently connected WebSocket clients
const clients = new Set<import("bun").ServerWebSocket<unknown>>();

function fmt(msg: BeaconMessage): string {
    const time = msg.ts ? msg.ts.slice(11, 19) : "??:??:??";
    const play = msg.playing ? "▶" : "⏸";
    const t = msg.t !== undefined ? `t=${msg.t.toFixed(1)}s` : "";
    const dur = msg.duration ? `/ ${msg.duration.toFixed(1)}s` : "";
    const vol =
        msg.volume !== undefined ? `vol=${Math.round(msg.volume * 100)}%${msg.muted ? " (muted)" : ""}` : "";
    const rate = msg.rate && msg.rate !== 1 ? `×${msg.rate}` : "";
    const src = msg.source ?? "";
    const name = msg.name ? `"${msg.name}"` : "";
    const extra = [msg.youtube_id && `yt:${msg.youtube_id}`, msg.playlist_id && `pl:${msg.playlist_id}`]
        .filter(Boolean)
        .join(" ");
    const parts = [play, src, name, extra, t, dur, vol, rate].filter(Boolean).join("  ");
    return `[${time}] ${(msg.type ?? "?").padEnd(5)} | ${parts}`;
}

const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
        if (server.upgrade(req)) return undefined;
        // Plain HTTP — return a status page
        const body = JSON.stringify({
            service: "waldiez-beacon-relay",
            clients: clients.size,
            note: "Connect via WebSocket to send or receive beacons.",
        });
        return new Response(body, {
            headers: { "Content-Type": "application/json" },
        });
    },
    websocket: {
        open(ws) {
            clients.add(ws);
            console.log(`[beacon] + client connected from ${ws.remoteAddress}  (${clients.size} total)`);
        },
        message(ws, raw) {
            try {
                const msg: BeaconMessage = JSON.parse(raw as string);
                // Print to terminal
                console.log(fmt(msg));
                // Relay to all other connected clients (listeners)
                const payload = typeof raw === "string" ? raw : raw.toString();
                for (const c of clients) {
                    if (c !== ws) {
                        try {
                            c.send(payload);
                        } catch {
                            /* listener already gone */
                        }
                    }
                }
            } catch {
                console.log(`[beacon] raw (non-JSON): ${raw}`);
            }
        },
        close(ws, code, reason) {
            clients.delete(ws);
            console.log(
                `[beacon] - client disconnected (${code}${reason ? ` — ${reason}` : ""})  (${clients.size} remaining)`,
            );
        },
    },
});

console.log(`\nWaldiez beacon relay listening on  ws://localhost:${server.port}`);
console.log(`Status page:                        http://localhost:${server.port}`);
console.log("\nRoles:");
console.log("  Broadcaster  →  open the player, Settings → Local Dev, click Beacon");
console.log("  Listener     →  connect any WebSocket client to the same address\n");
