import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { startBeaconJoin } from "./lib/beaconJoin";
import { refreshDesktopStatus } from "./lib/desktopStatus";
import { reportDiagnostic } from "./lib/diagnostics";
import { loadEditorProjectFromDesktopPath } from "./lib/editorPersistence";
import { parseMediaUrl } from "./lib/mediaSource";
import {
    bootstrapDefaultPrefsFromAsset,
    importPrefsFromFile,
    importPrefsFromUrl,
    readPrefs,
} from "./lib/moodDefaults";
import { importReaderDocumentFromBytes, isReaderFileName } from "./lib/readerImport";
import { getRuntimeContext } from "./lib/runtime";
import { mpvCheck, mpvPause, mpvStart } from "./lib/tauriPlayer";
import { nextWid } from "./lib/wid";
import { useEditorStore, usePlayerStore, useReaderStore } from "./stores";
import type { MediaFile, PlayerMode } from "./types";
import { MOOD_MODES } from "./types/mood";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}
const root = rootElement;
let stopBeaconJoin: (() => void) | null = null;

function applyImportedPrefsState(): void {
    const prefs = readPrefs();
    const store = usePlayerStore.getState();
    if (!prefs) return;
    if (typeof prefs.volume === "number" && isFinite(prefs.volume)) {
        store.setPlayback({ volume: Math.max(0, Math.min(1, prefs.volume)) });
    }
    if (typeof prefs.muted === "boolean") {
        store.setPlayback({ isMuted: prefs.muted });
    }
    if (typeof prefs.mode === "string" && (MOOD_MODES as readonly string[]).includes(prefs.mode)) {
        store.setPlayerMode(prefs.mode as PlayerMode);
    }
}

function findExistingMedia(
    library: MediaFile[],
    matcher: Partial<Pick<MediaFile, "path" | "youtubeId" | "playlistId">>,
): MediaFile | null {
    return (
        library.find(
            item =>
                (matcher.youtubeId && item.youtubeId === matcher.youtubeId
                    ? (item.playlistId ?? null) === (matcher.playlistId ?? null)
                    : false) || (matcher.path ? item.path === matcher.path : false),
        ) ?? null
    );
}

function upsertMediaUrl(src: string): void {
    const parsed = parseMediaUrl(src);
    const store = usePlayerStore.getState();
    if (!parsed) {
        reportDiagnostic({
            level: "warn",
            area: "launch",
            message: "Ignored an invalid media link from launch parameters.",
            detail: src,
        });
        return;
    }
    const existing = findExistingMedia(store.mediaLibrary, {
        path: parsed.path,
        youtubeId: parsed.youtubeId,
        playlistId: parsed.playlistId,
    });
    const entry: MediaFile = existing ?? {
        id: nextWid(),
        name: parsed.name,
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
    if (!existing) {
        store.addToLibrary(entry);
    }
    store.setCurrentMedia(entry);
    store.setPlayback({ currentTime: 0, duration: 0, isPlaying: true });
}

async function applyLaunchParams(params: URLSearchParams): Promise<boolean> {
    const widUrl = params.get("w");
    let widLoaded = false;
    if (widUrl) {
        widLoaded = await importPrefsFromUrl(widUrl);
        if (widLoaded) {
            applyImportedPrefsState();
        } else {
            reportDiagnostic({
                level: "warn",
                area: "launch",
                message: "Remote preset import failed.",
                detail: widUrl,
            });
        }
    }

    const src = params.get("src");
    if (src) {
        upsertMediaUrl(src);
    }

    const beaconUrl = params.get("beacon") ?? params.get("beacon_url");
    const topic = params.get("topic");
    const sessionId = params.get("session") ?? undefined;
    const protocol = params.get("beacon_protocol") ?? undefined;

    if (beaconUrl && topic) {
        stopBeaconJoin?.();
        stopBeaconJoin = startBeaconJoin({
            endpointUrl: beaconUrl,
            topic,
            sessionId,
            protocol,
        });
    } else if (beaconUrl || topic) {
        reportDiagnostic({
            level: "warn",
            area: "launch",
            message: "Ignored incomplete live sync launch parameters.",
            detail: { beaconUrl, topic },
        });
    }

    return widLoaded;
}

/**
 * Handle web+waldiez:// or waldiez:// protocol invocations.
 * Chrome opens the installed app at `/?uri=web+waldiez://...` (PWA); Tauri deep-links
 * call this with the raw URI string directly.
 *
 * Dispatches based on query params:
 *   ?w=<url>   — fetch and apply a remote .wid / .waldiez config file
 *   ?src=<url> — add a media URL to the player library and play it
 *
 * Returns true when a .wid file was successfully loaded.
 */
async function handleProtocolUri(overrideUri?: string): Promise<boolean> {
    const raw = overrideUri ?? new URLSearchParams(window.location.search).get("uri");
    if (!raw) return false;
    if (!raw.startsWith("web+waldiez://") && !raw.startsWith("waldiez://")) return false;
    try {
        const inner = new URL(raw.replace(/^(?:web\+)?waldiez:\/\//, "https://waldiez.internal/"));
        return await applyLaunchParams(inner.searchParams);
    } catch (error) {
        reportDiagnostic({
            level: "warn",
            area: "protocol",
            message: "Ignored a malformed deep link.",
            detail: error,
        });
        return false;
    }
}

/** Detect media type from file extension. */
function mediaTypeFromPath(path: string): "video" | "audio" {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return ["mp3", "wav", "ogg", "flac", "aac", "m4a", "opus"].includes(ext) ? "audio" : "video";
}

/**
 * Set up Tauri-specific event listeners for file-open (OS file association /
 * CLI args) and deep-link (waldiez://) events.  Called once before render.
 */
async function setupTauriListeners(): Promise<{
    listenersReady: boolean;
    fileOpenEvents: boolean;
    deepLinkEvents: boolean;
}> {
    const { listen } = await import("@tauri-apps/api/event");
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    // File opened from Finder/Explorer/CLI
    await listen<string>("file-opened", async event => {
        const path = event.payload;
        const lower = path.toLowerCase();
        const name = path.replace(/.*[\\/]/, "");
        const baseLower = name.toLowerCase();

        if (lower.endsWith(".wid") || lower.endsWith(".waldiez")) {
            // Read the file and pass as a File object to the existing importer.
            try {
                const { readFile } = await import("@tauri-apps/plugin-fs");
                const bytes = await readFile(path);
                const file = new File([bytes], name);
                const ok = await importPrefsFromFile(file);
                if (ok) {
                    applyImportedPrefsState();
                } else {
                    reportDiagnostic({
                        level: "warn",
                        area: "file-open",
                        message: "Preset import failed.",
                        detail: name,
                    });
                }
            } catch (err) {
                console.warn("[file-opened] failed to import preset:", err);
                reportDiagnostic({
                    level: "error",
                    area: "file-open",
                    message: "Failed to import preset file.",
                    detail: err,
                });
            }
        } else if (baseLower === "manifest" || isReaderFileName(path)) {
            try {
                const { readFile } = await import("@tauri-apps/plugin-fs");
                const bytes = await readFile(path);
                const sourceUrl = convertFileSrc(path);
                const document = await importReaderDocumentFromBytes({
                    name,
                    path,
                    sourceUrl,
                    bytes,
                });
                useReaderStore.getState().setCurrentDocument(document);
                usePlayerStore.getState().setPlayerMode("reader");
            } catch (err) {
                console.warn("[file-opened] failed to open reader document:", err);
                reportDiagnostic({
                    level: "error",
                    area: "file-open",
                    message: "Failed to open document in reader mode.",
                    detail: err,
                });
            }
        } else if (lower.endsWith(".wdz")) {
            try {
                const project = await loadEditorProjectFromDesktopPath(path);
                useEditorStore.getState().setCurrentProject(project);
                usePlayerStore.getState().setPlayerMode("editor");
            } catch (err) {
                console.warn("[file-opened] failed to load project:", err);
                reportDiagnostic({
                    level: "error",
                    area: "file-open",
                    message: "Failed to load desktop project bundle.",
                    detail: err,
                });
            }
        } else {
            // Video / audio — add to library and select it.
            const assetUrl = convertFileSrc(path);
            const name = path.replace(/.*[\\/]/, "");
            const store = usePlayerStore.getState();
            const existing = findExistingMedia(store.mediaLibrary, { path: assetUrl });
            const entry: MediaFile = existing ?? {
                id: nextWid(),
                name,
                path: assetUrl,
                type: mediaTypeFromPath(path),
                source: "file",
                duration: 0,
                size: 0,
                createdAt: new Date(),
            };
            if (!existing) {
                store.addToLibrary(entry);
            }
            store.setCurrentMedia(entry);
            store.setPlayback({ currentTime: 0, duration: 0, isPlaying: true });
        }
    });
    // Deep-link (waldiez://) forwarded from the Tauri backend
    await listen<string>("deep-link", async event => {
        const ok = await handleProtocolUri(event.payload);
        if (!ok) {
            reportDiagnostic({
                level: "warn",
                area: "protocol",
                message: "Deep link did not produce any app changes.",
                detail: event.payload,
            });
        }
    });
    return {
        listenersReady: true,
        fileOpenEvents: true,
        deepLinkEvents: true,
    };
}

async function start() {
    const runtime = getRuntimeContext();

    void refreshDesktopStatus();

    const bootstrappedDefaults = await bootstrapDefaultPrefsFromAsset();
    if (bootstrappedDefaults) {
        applyImportedPrefsState();
    }

    const widLoadedFromProtocol = await handleProtocolUri();
    const widLoadedFromWebQuery = await applyLaunchParams(new URLSearchParams(window.location.search));
    const widLoaded = bootstrappedDefaults || widLoadedFromProtocol || widLoadedFromWebQuery;

    // Set up Tauri event listeners before render (non-blocking for non-Tauri).
    if (runtime.isTauri) {
        try {
            const listenerStatus = await setupTauriListeners();
            void refreshDesktopStatus(listenerStatus);
        } catch (error) {
            reportDiagnostic({
                level: "error",
                area: "desktop",
                message: "Failed to initialize desktop file-open/deep-link listeners.",
                detail: error,
            });
            void refreshDesktopStatus({
                listenersReady: false,
                fileOpenEvents: false,
                deepLinkEvents: false,
            });
        }
    }

    // Packaged desktop: prewarm mpv daemon early and keep it paused.
    if (runtime.kind === "tauri-packaged") {
        void (async () => {
            try {
                const ok = await mpvCheck();
                if (!ok) return;
                await mpvStart();
                await mpvPause();
            } catch {
                // Optional optimization; ignore failures.
            }
        })();
    }

    // Apply mode from prefs on first visit OR when a ?w= protocol invocation
    // just wrote new prefs (widLoaded=true) — so the mode takes effect before render.
    if (!localStorage.getItem("waldiez-player-storage") || widLoaded) {
        const prefs = readPrefs();
        const mode = typeof prefs?.mode === "string" ? prefs.mode : null;
        if (mode && (MOOD_MODES as readonly string[]).includes(mode)) {
            usePlayerStore.getState().setPlayerMode(mode as PlayerMode);
        }
    }

    createRoot(root).render(
        <StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </StrictMode>,
    );
}

void start();
