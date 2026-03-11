import { readBeaconSettings } from "@/lib/beaconSettings";
import { getDesktopStatus } from "@/lib/desktopStatus";
import { getRecentDiagnostics } from "@/lib/diagnostics";
import { readPrefs } from "@/lib/moodDefaults";
import { getRuntimeContext } from "@/lib/runtime";
import { isTauri, mpvCheck, ytCheck } from "@/lib/tauriPlayer";
import { readUiSettings } from "@/lib/uiSettings";
import { useEditorStore, usePlayerStore } from "@/stores";
import type { MediaFile } from "@/types";

function basename(input: string): string {
    const parts = input.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? input;
}

function summarizeUrl(input: string): string {
    try {
        const url = new URL(input);
        return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`;
    } catch {
        return input;
    }
}

function redactSecret(value: string): string {
    if (!value) return "";
    if (value.length <= 8) return "***";
    return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

function sanitizeMediaFile(file: MediaFile | null) {
    if (!file) return null;
    return {
        id: file.id,
        name: file.name,
        type: file.type,
        source: file.source ?? "file",
        youtubeId: file.youtubeId ?? null,
        playlistId: file.playlistId ?? null,
        streamProtocol: file.streamProtocol ?? null,
        streamTargetId: file.streamTargetId ?? null,
        pathSummary:
            file.source === "file"
                ? basename(file.path)
                : file.source === "youtube"
                  ? summarizeUrl(file.path)
                  : file.source === "url" || file.source === "soundcloud" || file.source === "spotify"
                    ? summarizeUrl(file.path)
                    : file.source === "stream"
                      ? summarizeUrl(file.path)
                      : file.path,
    };
}

function sanitizeUiSettings() {
    const ui = readUiSettings();
    return {
        ...ui,
        youtubeApiKey: ui.youtubeApiKey ? redactSecret(ui.youtubeApiKey) : "",
        tmdbApiKey: ui.tmdbApiKey ? redactSecret(ui.tmdbApiKey) : "",
    };
}

function sanitizeBeaconSettings() {
    const beacon = readBeaconSettings();
    return {
        activeTargetId: beacon.activeTargetId,
        customTargets: beacon.customTargets.map(target => ({
            id: target.id,
            name: target.name,
            protocol: target.protocol,
            url: target.url ? summarizeUrl(target.url) : undefined,
            hasSubTopic: Boolean(target.subTopic),
            hasPubTopic: Boolean(target.pubTopic),
        })),
    };
}

function summarizePrefs() {
    const prefs = readPrefs();
    if (!prefs) return null;

    return {
        version: prefs.v ?? null,
        mode: prefs.mode ?? null,
        muted: prefs.muted ?? null,
        volume: prefs.volume ?? null,
        syncDefaultsFromLatest: prefs.syncDefaultsFromLatest ?? null,
        modes: Object.fromEntries(
            Object.entries(prefs.modes ?? {}).map(([mode, data]) => [
                mode,
                {
                    tracks: data.ytTracks?.length ?? 0,
                    savedTrackId: data.savedTrackId ?? null,
                    savedTime: data.savedTime ?? null,
                },
            ]),
        ),
        modeDefaults: Object.fromEntries(
            Object.entries(prefs.modeDefaults ?? {}).map(([mode, tracks]) => [mode, tracks.length]),
        ),
    };
}

async function getAppMeta() {
    if (!isTauri()) return null;
    try {
        const { getIdentifier, getName, getTauriVersion, getVersion, getBundleType } =
            await import("@tauri-apps/api/app");
        const [name, version, identifier, tauriVersion, bundleType] = await Promise.all([
            getName(),
            getVersion(),
            getIdentifier(),
            getTauriVersion(),
            getBundleType(),
        ]);
        return { name, version, identifier, tauriVersion, bundleType };
    } catch {
        return null;
    }
}

export async function buildSupportSnapshot() {
    const store = usePlayerStore.getState();
    const editorDraft = useEditorStore.getState().currentProject;
    const runtime = getRuntimeContext();
    const app = await getAppMeta();

    let backendAvailability: { ytDlp: boolean | null; mpv: boolean | null } = {
        ytDlp: null,
        mpv: null,
    };

    if (runtime.isTauri) {
        const [ytDlp, mpv] = await Promise.all([ytCheck().catch(() => null), mpvCheck().catch(() => null)]);
        backendAvailability = { ytDlp, mpv };
    }

    return {
        generatedAt: new Date().toISOString(),
        runtime,
        app,
        backendAvailability,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        language: typeof navigator !== "undefined" ? navigator.language : null,
        currentMedia: sanitizeMediaFile(store.currentMedia),
        mediaLibrary: {
            count: store.mediaLibrary.length,
            items: store.mediaLibrary.map(sanitizeMediaFile),
        },
        playback: store.playback,
        repeatMode: store.repeatMode,
        playerMode: store.playerMode,
        uiSettings: sanitizeUiSettings(),
        beaconSettings: sanitizeBeaconSettings(),
        prefs: summarizePrefs(),
        desktopStatus: getDesktopStatus(),
        editorDraft: editorDraft
            ? {
                  id: editorDraft.id,
                  title: editorDraft.title,
                  sceneCount: editorDraft.scenes.length,
                  sourceType: editorDraft.source.sourceType,
              }
            : null,
        recentDiagnostics: getRecentDiagnostics(12),
    };
}

function triggerDownload(text: string, filename: string) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export async function exportSupportSnapshot(): Promise<string> {
    const snapshot = await buildSupportSnapshot();
    const text = `${JSON.stringify(snapshot, null, 2)}\n`;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `waldiez-support-${stamp}.json`;

    if (isTauri()) {
        try {
            const [{ save }, { writeTextFile }] = await Promise.all([
                import("@tauri-apps/plugin-dialog"),
                import("@tauri-apps/plugin-fs"),
            ]);
            const path = await save({
                title: "Export support snapshot",
                defaultPath: filename,
                filters: [{ name: "JSON", extensions: ["json"] }],
            });
            if (path) {
                await writeTextFile(path, text);
                return typeof path === "string" ? path : filename;
            }
        } catch {
            // fall through to browser download
        }
    }

    triggerDownload(text, filename);
    return filename;
}
