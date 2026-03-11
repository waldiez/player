import { reportDiagnostic } from "@/lib/diagnostics";
import { parseMediaUrl } from "@/lib/mediaSource";
import { nextWid } from "@/lib/wid";
import { usePlayerStore } from "@/stores";
import type { MediaFile } from "@/types";
import mqtt from "mqtt";

export interface BeaconJoinConfig {
    endpointUrl: string;
    topic: string;
    sessionId?: string;
    protocol?: string;
}

interface BeaconPayload {
    type?: "start" | "state" | "stop";
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

function asFiniteNumber(value: unknown): number | null {
    return typeof value === "number" && isFinite(value) ? value : null;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function inferSessionId(topic: string): string | undefined {
    const parts = topic.split("/").filter(Boolean);
    return parts.at(-1);
}

function maybeLoadMediaFromPayload(payload: BeaconPayload): void {
    const store = usePlayerStore.getState();
    if (store.currentMedia) return;

    if (payload.youtube_id) {
        const existing = store.mediaLibrary.find(
            item =>
                item.youtubeId === payload.youtube_id &&
                (item.playlistId ?? null) === (payload.playlist_id ?? null),
        );
        if (existing) {
            store.setCurrentMedia(existing);
            return;
        }
        const watchUrl = payload.playlist_id
            ? `https://www.youtube.com/watch?v=${payload.youtube_id}&list=${payload.playlist_id}`
            : `https://www.youtube.com/watch?v=${payload.youtube_id}`;
        const parsed = parseMediaUrl(watchUrl);
        if (!parsed) return;
        const entry: MediaFile = {
            id: nextWid(),
            name: payload.name?.trim() || parsed.name,
            path: parsed.path,
            type: "audio",
            source: parsed.sourceType,
            embedUrl: parsed.embedUrl,
            youtubeId: parsed.youtubeId,
            playlistId: parsed.playlistId,
            duration: 0,
            size: 0,
            createdAt: new Date(),
        };
        store.addToLibrary(entry);
        store.setCurrentMedia(entry);
    }
}

function applyPayload(payload: BeaconPayload): void {
    const store = usePlayerStore.getState();

    maybeLoadMediaFromPayload(payload);

    const updates: Parameters<typeof store.setPlayback>[0] = {};

    if (typeof payload.playing === "boolean") updates.isPlaying = payload.playing;
    const t = asFiniteNumber(payload.t);
    if (t !== null) updates.currentTime = Math.max(0, t);
    const duration = asFiniteNumber(payload.duration);
    if (duration !== null) updates.duration = Math.max(0, duration);
    const volume = asFiniteNumber(payload.volume);
    if (volume !== null) updates.volume = clamp01(volume);
    if (typeof payload.muted === "boolean") updates.isMuted = payload.muted;
    const rate = asFiniteNumber(payload.rate);
    if (rate !== null) updates.playbackRate = Math.max(0.25, rate);

    if (Object.keys(updates).length > 0) {
        store.setPlayback(updates);
    }
}

function parseBeaconPayload(raw: string): BeaconPayload | null {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return null;
        return parsed as BeaconPayload;
    } catch {
        return null;
    }
}

function isMqttJoin(config: BeaconJoinConfig): boolean {
    if (config.protocol === "mqtts") return true;
    return /\/mqtt(?:\b|\/|\?)/i.test(config.endpointUrl);
}

export function startBeaconJoin(config: BeaconJoinConfig): () => void {
    const expectedSession = config.sessionId ?? inferSessionId(config.topic);
    let latestTs = 0;

    const handlePayload = (payload: BeaconPayload) => {
        if (!payload) return;
        if (expectedSession && payload.session_id && payload.session_id !== expectedSession) return;

        const ts = payload.ts ? Date.parse(payload.ts) : NaN;
        if (Number.isFinite(ts) && ts < latestTs) return;
        if (Number.isFinite(ts)) latestTs = ts;

        applyPayload(payload);
    };

    if (isMqttJoin(config)) {
        const client = mqtt.connect(config.endpointUrl, {
            clientId: `wdz-listener-${nextWid()}`,
            clean: true,
            reconnectPeriod: 1_500,
        });

        client.on("connect", () => {
            client.subscribe(config.topic, { qos: 0 }, err => {
                if (err) {
                    console.warn("[beacon-join] subscribe failed", err);
                    reportDiagnostic({
                        level: "warn",
                        area: "beacon",
                        message: `Live sync subscription failed for ${config.topic}.`,
                        detail: err,
                    });
                }
            });
        });
        client.on("message", (_topic, message) => {
            const payload = parseBeaconPayload(message.toString());
            if (!payload) {
                reportDiagnostic({
                    level: "warn",
                    area: "beacon",
                    message: "Ignored an invalid live sync payload.",
                });
                return;
            }
            handlePayload(payload);
        });
        client.on("error", err => {
            console.warn("[beacon-join] mqtt error", err);
            reportDiagnostic({
                level: "error",
                area: "beacon",
                message: "Live sync MQTT connection error.",
                detail: err,
            });
        });

        return () => {
            client.end(false);
        };
    }

    const ws = new WebSocket(config.endpointUrl);
    ws.onmessage = ev => {
        if (typeof ev.data !== "string") return;
        const payload = parseBeaconPayload(ev.data);
        if (!payload) {
            reportDiagnostic({
                level: "warn",
                area: "beacon",
                message: "Ignored an invalid live sync payload.",
            });
            return;
        }
        handlePayload(payload);
    };
    ws.onerror = ev => {
        console.warn("[beacon-join] ws error", ev);
        reportDiagnostic({
            level: "error",
            area: "beacon",
            message: "Live sync WebSocket connection error.",
        });
    };

    return () => {
        ws.close();
    };
}

export interface BeaconJoinUrlConfig {
    mediaUrl?: string;
    endpointUrl: string;
    topic: string;
    sessionId?: string;
    protocol?: string;
}

export function buildBeaconJoinUrl(config: BeaconJoinUrlConfig): string {
    const url = new URL(window.location.href);
    url.search = "";

    if (config.mediaUrl) url.searchParams.set("src", config.mediaUrl);
    url.searchParams.set("beacon", config.endpointUrl);
    url.searchParams.set("topic", config.topic);
    if (config.sessionId) url.searchParams.set("session", config.sessionId);
    if (config.protocol) url.searchParams.set("beacon_protocol", config.protocol);
    url.searchParams.set("sync", "1");

    return url.toString();
}
