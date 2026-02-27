/**
 * beaconSettings — persists the user's preferred beacon endpoint and any
 * custom stream targets they add, on top of the built-in STREAM_TARGETS.
 */
import { type BeaconTargetInfo } from "@/lib/beaconTransport";
import { isBeaconCapableTarget, isMqttWsTarget } from "@/lib/streamTargets";
import type { StreamProtocol } from "@/types/player";

const KEY = "wideria-beacon-settings";

export interface BeaconTarget {
    id: string;
    name: string;
    protocol: StreamProtocol;
    /** WebSocket / MQTT-WS URL */
    url?: string;
    /** MQTT subscribe topic (receive commands) or WebRTC room */
    subTopic?: string;
    /** MQTT publish topic (send beacon state). Defaults to subTopic when absent. */
    pubTopic?: string;
    /** WebRTC signaling URL */
    signalingUrl?: string;
    isCustom: true;
}

export interface BeaconSettings {
    /** ID of the active/preferred beacon target (built-in or custom). */
    activeTargetId: string;
    customTargets: BeaconTarget[];
}

const DEFAULT_ACTIVE = "eclipse-mqtt-ws";

function defaults(): BeaconSettings {
    return { activeTargetId: DEFAULT_ACTIVE, customTargets: [] };
}

export function readBeaconSettings(): BeaconSettings {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<BeaconSettings>;
            return { ...defaults(), ...parsed };
        }
    } catch {
        /* corrupted storage — fall through */
    }
    return defaults();
}

export function writeBeaconSettings(s: BeaconSettings): void {
    localStorage.setItem(KEY, JSON.stringify(s));
}

/**
 * Resolve the beacon transport info for the active target.
 * Returns null when no connectable target can be found.
 */
export function resolveActiveBeaconTarget(
    builtins: { id: string; protocol: StreamProtocol; url?: string; channel?: string }[],
    settings: BeaconSettings,
): BeaconTargetInfo | null {
    const all: { id: string; protocol: StreamProtocol; url?: string; channel?: string }[] = [
        ...builtins,
        ...settings.customTargets.map(t => ({
            id: t.id,
            protocol: t.protocol,
            url: t.url,
            channel: t.pubTopic ?? t.subTopic,
        })),
    ];

    // Try the explicitly selected target first
    const active = all.find(t => t.id === settings.activeTargetId);
    const resolved = toBeaconTargetInfo(active);
    if (resolved) return resolved;

    // Fallback: first beacon-capable built-in
    for (const t of builtins) {
        const r = toBeaconTargetInfo(t);
        if (r) return r;
    }
    return null;
}

function toBeaconTargetInfo(
    t: { id?: string; protocol: StreamProtocol; url?: string; channel?: string } | undefined,
): BeaconTargetInfo | null {
    if (!t?.url) return null;

    // MQTT-over-WebSocket
    if (t.protocol === "mqtts" && (t.url.startsWith("wss://") || t.url.startsWith("ws://"))) {
        return { url: t.url, protocol: "mqtts", channel: t.channel ?? "waldiez://player" };
    }

    // Plain WebSocket
    if (t.url.startsWith("ws://") || t.url.startsWith("wss://")) {
        return { url: t.url, protocol: t.protocol };
    }

    return null;
}

// Re-export helpers that SettingsPanel uses
export { isBeaconCapableTarget, isMqttWsTarget };
