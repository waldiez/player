/**
 * beaconTransport — unified send/disconnect interface over either:
 *   • Plain WebSocket  (protocol: "ws" | "wss")
 *   • MQTT over WebSocket  (protocol: "mqtts" with a wss:// URL)
 *
 * MQTT topics use the WID of the session so any subscriber can listen
 * to a specific session or all sessions:
 *
 *   publish topic  →  `${channel}/${sessionWid}`
 *                     e.g. waldiez://player/20260227T143052.0000Z-a3f91c
 *
 *   subscribe all  →  waldiez://player/+
 */
import mqtt from "mqtt";

export interface BeaconTransportCallbacks {
    onOpen: () => void;
    /** Called only when the connection fails to open (before `onOpen`). */
    onConnectError: (msg: string) => void;
    /**
     * Called when the connection closes.
     * `intentional = true` when WE called disconnect(); false on unexpected drop.
     */
    onClose: (intentional: boolean, code?: number, reason?: string) => void;
}

export interface BeaconTransport {
    /** Serialize `payload` and publish it. No-op when not connected. */
    publish(payload: object): void;
    /** Gracefully close the connection. */
    disconnect(): void;
}

// ── Plain WebSocket transport ─────────────────────────────────────────────

function wsTransport(url: string, cbs: BeaconTransportCallbacks): BeaconTransport {
    let didOpen = false;
    let intentional = false;
    const ws = new WebSocket(url);

    ws.onopen = () => {
        didOpen = true;
        cbs.onOpen();
    };
    ws.onerror = ev => {
        console.error("[beacon:ws] onerror", ev, "url:", url);
        if (!didOpen) {
            cbs.onConnectError(`Could not connect to ${url} — server unreachable or cert invalid.`);
        }
    };
    ws.onclose = ev => {
        cbs.onClose(intentional || !didOpen, ev.code, ev.reason);
    };

    return {
        publish(payload) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        },
        disconnect() {
            intentional = true;
            ws.close();
        },
    };
}

// ── MQTT-over-WebSocket transport ─────────────────────────────────────────

function mqttWsTransport(
    url: string,
    /** Base topic prefix, e.g. "waldiez://player". */
    topicPrefix: string,
    /** Session WID — appended to topicPrefix to form the publish topic. */
    sessionWid: string,
    cbs: BeaconTransportCallbacks,
): BeaconTransport {
    const topic = `${topicPrefix}/${sessionWid}`;
    const clientId = `wdz-player-${sessionWid}`;
    let didOpen = false;
    let intentional = false;

    const client = mqtt.connect(url, {
        clientId,
        clean: true,
        reconnectPeriod: 0, // no auto-reconnect — we manage reconnects at the component level
    });

    client.on("connect", () => {
        didOpen = true;
        cbs.onOpen();
    });
    client.on("error", err => {
        console.error("[beacon:mqtt] error", err, "url:", url);
        if (!didOpen) {
            cbs.onConnectError(`MQTT connect failed (${url}): ${err.message}`);
        }
    });
    client.on("close", () => {
        cbs.onClose(intentional || !didOpen);
    });

    return {
        publish(payload) {
            if (client.connected) {
                client.publish(topic, JSON.stringify(payload), { qos: 0 });
            }
        },
        disconnect() {
            intentional = true;
            client.end(/* force */ false);
        },
    };
}

// ── Factory ───────────────────────────────────────────────────────────────

export interface BeaconTargetInfo {
    /** ws:// / wss:// for plain WebSocket; wss:// for MQTT-over-WS */
    url: string;
    /** "ws" | "wss" → plain WebSocket; "mqtts" → MQTT over WebSocket */
    protocol: string;
    /** Topic prefix for MQTT targets (e.g. "waldiez://player"). */
    channel?: string;
}

/**
 * Open a beacon transport.
 *
 * @param target  Resolved target config (URL + protocol + optional channel).
 * @param sessionWid  WID of the current beacon session.
 * @param cbs  Lifecycle callbacks.
 */
export function openBeaconTransport(
    target: BeaconTargetInfo,
    sessionWid: string,
    cbs: BeaconTransportCallbacks,
): BeaconTransport {
    const { url, protocol, channel } = target;

    if (protocol === "mqtts") {
        // MQTT over WebSocket — url must be wss:// or ws://
        const prefix = channel ?? "waldiez://player";
        return mqttWsTransport(url, prefix, sessionWid, cbs);
    }

    // Plain WebSocket (ws:// or wss://)
    return wsTransport(url, cbs);
}
