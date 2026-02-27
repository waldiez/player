import type { StreamProtocol } from "@/types/player";

export interface StreamTargetProfile {
    id: string;
    name: string;
    protocol: StreamProtocol;
    url?: string;
    channel?: string;
    signalingUrl?: string;
    role: "primary" | "fallback" | "low-latency" | "bridge";
}

export const STREAM_TARGETS: StreamTargetProfile[] = [
    // ── MQTT over WebSocket (beacon-capable, topic = channel/sessionWid) ──
    {
        id: "eclipse-mqtt-ws",
        name: "Eclipse Test Broker",
        protocol: "mqtts",
        url: "wss://mqtt.eclipseprojects.io:443/mqtt",
        channel: "waldiez://player",
        role: "primary",
    },
    {
        id: "waldiez-mqtt-ws",
        name: "Waldiez MQTT",
        protocol: "mqtts",
        url: "wss://mqtt.waldiez.io/ws",
        channel: "waldiez://player",
        role: "primary",
    },
    // ── Plain WebSocket ───────────────────────────────────────────────────
    {
        id: "local-dev",
        name: "Local Dev",
        protocol: "ws",
        url: "ws://localhost:8765",
        role: "primary",
    },
    {
        id: "default-wss",
        name: "Default WSS",
        protocol: "wss",
        url: "wss://stream.waldiez.io/player/live",
        role: "primary",
    },
    // ── Other / future transports ─────────────────────────────────────────
    {
        id: "mqtt-tcp",
        name: "MQTT TCP",
        protocol: "mqtts",
        url: "mqtts://mqtt.waldiez.io:8883",
        channel: "waldiez://player",
        role: "fallback",
    },
    {
        id: "webrtc-relay",
        name: "WebRTC Relay",
        protocol: "webrtc",
        signalingUrl: "wss://stream.waldiez.io/signal",
        channel: "player-live",
        role: "low-latency",
    },
    {
        id: "rtsp-relay",
        name: "RTSP Relay",
        protocol: "rtsp",
        url: "rtsp://relay.waldiez.io/player/live",
        role: "bridge",
    },
];

export function isBrowserPlayableStreamProtocol(protocol: StreamProtocol): boolean {
    return protocol === "http" || protocol === "https";
}

/** Returns true for protocols that can carry a beacon (plain WS/WSS). */
export function isWsBeaconProtocol(protocol: StreamProtocol): boolean {
    return protocol === "ws" || protocol === "wss";
}

/** Returns true for MQTT-over-WebSocket targets (wss:// or ws:// with mqtts protocol). */
export function isMqttWsTarget(t: StreamTargetProfile): boolean {
    return (
        t.protocol === "mqtts" &&
        t.url !== undefined &&
        (t.url.startsWith("wss://") || t.url.startsWith("ws://"))
    );
}

/** Returns true for targets that can carry a state beacon (WS, WSS, or MQTT-over-WS). */
export function isBeaconCapableTarget(t: { protocol: StreamProtocol; url?: string }): boolean {
    return (
        isWsBeaconProtocol(t.protocol) ||
        (t.protocol === "mqtts" &&
            t.url !== undefined &&
            (t.url.startsWith("wss://") || t.url.startsWith("ws://")))
    );
}
