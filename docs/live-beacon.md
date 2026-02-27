# Waldiez Player — Live Beacon

The **beacon** broadcasts your player's current state (what's playing, position, volume, playback rate) over a WebSocket connection. Anyone who connects to the same relay server receives your state in real time — no audio or video is streamed, only lightweight JSON.

---

## Quick Start — zero config (Eclipse public broker)

The player defaults to the **Eclipse public MQTT test broker** (`mqtt.eclipseprojects.io`), so no server setup is required.

### Step 1 — Check the active endpoint

1. Open the player.
2. Click **⚙ Settings** (top-right header).
3. **Eclipse Test Broker** should already be selected (filled radio dot). If not, click it.

### Step 2 — Broadcast

1. Pick any mood, load a track, press play.
2. Click **Beacon** in the toolbar.
3. The status line turns green — you're live.

The player publishes to the MQTT topic:

```
waldiez://player/{session_wid}
e.g.  waldiez://player/20260227T143052.0000Z-a3f91c
```

---

## What should the other person do to listen live?

Subscribe to `waldiez/player/+` to receive all sessions, or use the exact session topic.

### Option A — mqtt CLI (mosquitto / mqtt.js)

```bash
# mosquitto (apt install mosquitto-clients)
mosquitto_sub -h mqtt.eclipseprojects.io -p 1883 -t "waldiez://player/+" -v

# mqtt.js CLI (npm i -g mqtt)
mqtt sub -h mqtt.eclipseprojects.io -t "waldiez://player/+"
```

### Option B — Browser / Node snippet

```js
import mqtt from "mqtt";

const client = mqtt.connect("wss://mqtt.eclipseprojects.io:443/mqtt");
client.on("connect", () => client.subscribe("waldiez://player/+"));
client.on("message", (topic, msg) => {
  const state = JSON.parse(msg.toString());
  console.log(`${state.playing ? "▶" : "⏸"}  ${state.name}  t=${state.t}s`);
});
```

### Option C — MQTT Explorer (GUI)

[MQTT Explorer](https://mqtt-explorer.com) is a cross-platform desktop app.
Connect to `mqtt.eclipseprojects.io:1883` (no auth) and subscribe to `waldiez://player/#`.

---

## Local relay server (no external broker)

If you want a self-contained setup without the Eclipse broker:

```bash
cd ~/Projects/waldiez/player
bun scripts/ws_beacon_test.ts
```

Then in Settings → select **Local Dev** (`ws://localhost:8765`).

The relay server forwards every beacon to all connected plain-WS clients:

```bash
# Connect a listener
npx wscat -c ws://localhost:8765
```

To expose the local relay remotely:

```bash
# Cloudflare Tunnel (zero config, free)
cloudflared tunnel --url ws://localhost:8765
# → gives you e.g. wss://random-name.trycloudflare.com

# ngrok
ngrok tcp 8765
```

Add the public URL in Settings → Add Custom Endpoint (protocol: WSS), select it as active, then share the URL with your listeners.

---

## Private Waldiez MQTT broker

For team/production use, switch to the Waldiez broker:

1. Settings → select **Waldiez MQTT** (`wss://mqtt.waldiez.io/ws`).
2. Topic pattern remains `waldiez/player/+`.

Listeners connect to `wss://mqtt.waldiez.io/ws` with an MQTT client.

---

## Importing the default preferences

A clean-slate `default.wid` is included in `public/default.wid`. Import it to reset your player to sensible defaults with all mood tracks pre-loaded:

1. In the player, click **Import** (toolbar or Settings export/import area).
2. Select `public/default.wid`.
3. The mood tracks and EQ settings are restored instantly.

---

## Beacon message format

Every message is a JSON object. Possible `type` values: `"start"`, `"state"`, `"stop"`.

```jsonc
{
  "type": "state", // "start" on connect, "state" on heartbeat/change, "stop" on disconnect
  "session_id": "20260227T143052.0000Z-a3f91c", // WID — unique per beacon session
  "source": "youtube", // "youtube" | "spotify" | "file" | "camera" | "microphone" | "screen" | "stream" | "none"
  "name": "Habits — Vintage 1930s Jazz", // track name (YT title auto-updates for playlists)
  "youtube_id": "7hHZnvjCbVw", // present for YouTube sources
  "playlist_id": "PLxyz...", // present when playing a YT playlist
  "playing": true, // true = playing, false = paused
  "t": 24.0, // current position in seconds (1 decimal)
  "duration": 210.3, // total duration in seconds
  "volume": 0.8, // 0.00–1.00
  "muted": false,
  "rate": 1, // playback rate (0.5 | 0.75 | 1 | 1.25 | 1.5 | 2)
  "ts": "2026-02-27T14:30:52.000Z", // ISO 8601 wall-clock timestamp
}
```

**Heartbeat interval:** every 5 seconds while live, plus an immediate send on any state change (debounced 300 ms).

---

## Troubleshooting

| Symptom                       | Likely cause                               | Fix                                                      |
| ----------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `MQTT connect failed`         | Broker unreachable or network firewall     | Try Eclipse broker; check port 443 is open               |
| `Could not connect to ws://…` | Local relay not running                    | Run `bun scripts/ws_beacon_test.ts`                      |
| `Mixed content blocked`       | App served over HTTPS, endpoint is `ws://` | Use `wss://` (tunnel, or switch to Eclipse/Waldiez MQTT) |
| `Beacon dropped (code 1006)`  | Network interruption                       | Click Beacon to reconnect                                |
| Error says `cert invalid`     | Self-signed TLS cert on custom server      | Use a valid cert or a tunnel                             |
| Wrong endpoint connects       | Media entry has an embedded stream target  | Select a non-stream track, or override in Settings       |

---

## Summary — what each person does

```
You (broadcaster)                   The other person (listener)
─────────────────────────────────   ──────────────────────────────────────
(default: Eclipse broker,           Subscribe via MQTT client:
 no server setup needed)              mosquitto_sub -h mqtt.eclipseprojects.io
                                      -t "waldiez/player/+" -v

Play music →                        Receive live JSON state updates
  click Beacon                        on topic waldiez/player/{your_session_wid}
```
