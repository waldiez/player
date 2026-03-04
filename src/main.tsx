import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { startBeaconJoin } from "./lib/beaconJoin";
import { parseMediaUrl } from "./lib/mediaSource";
import {
    bootstrapDefaultPrefsFromAsset,
    importPrefsFromFile,
    importPrefsFromUrl,
    readPrefs,
} from "./lib/moodDefaults";
import { getRuntimeContext } from "./lib/runtime";
import { mpvCheck, mpvPause, mpvStart } from "./lib/tauriPlayer";
import { nextWid } from "./lib/wid";
import { usePlayerStore } from "./stores";
import type { MediaFile, PlayerMode } from "./types";
import { MOOD_MODES } from "./types/mood";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}
const root = rootElement;
let stopBeaconJoin: (() => void) | null = null;

function upsertMediaUrl(src: string): void {
    const parsed = parseMediaUrl(src);
    if (!parsed) return;
    const entry: MediaFile = {
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
    usePlayerStore.getState().addToLibrary(entry);
    usePlayerStore.getState().setCurrentMedia(entry);
}

async function applyLaunchParams(params: URLSearchParams): Promise<boolean> {
    const widUrl = params.get("w");
    let widLoaded = false;
    if (widUrl) {
        widLoaded = await importPrefsFromUrl(widUrl);
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
    } catch {
        // ignore malformed URIs
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
async function setupTauriListeners(): Promise<void> {
    const { listen } = await import("@tauri-apps/api/event");
    const { convertFileSrc } = await import("@tauri-apps/api/core");

    // File opened from Finder/Explorer/CLI
    await listen<string>("file-opened", async event => {
        const path = event.payload;
        const lower = path.toLowerCase();

        if (lower.endsWith(".wid") || lower.endsWith(".waldiez")) {
            // Read the file and pass as a File object to the existing importer.
            try {
                const { readFile } = await import("@tauri-apps/plugin-fs");
                const bytes = await readFile(path);
                const name = path.replace(/.*[\\/]/, "");
                const file = new File([bytes], name);
                await importPrefsFromFile(file);
            } catch (err) {
                console.warn("[file-opened] failed to import preset:", err);
            }
        } else if (lower.endsWith(".wdz")) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("load_project", { path }).catch(err =>
                console.warn("[file-opened] failed to load project:", err),
            );
        } else {
            // Video / audio — add to library and select it.
            const assetUrl = convertFileSrc(path);
            const name = path.replace(/.*[\\/]/, "");
            const entry: MediaFile = {
                id: nextWid(),
                name,
                path: assetUrl,
                type: mediaTypeFromPath(path),
                source: "file",
                duration: 0,
                size: 0,
                createdAt: new Date(),
            };
            usePlayerStore.getState().addToLibrary(entry);
            usePlayerStore.getState().setCurrentMedia(entry);
        }
    });

    // Deep-link (waldiez://) forwarded from the Tauri backend
    await listen<string>("deep-link", async event => {
        await handleProtocolUri(event.payload);
    });
}

async function start() {
    const runtime = getRuntimeContext();

    await bootstrapDefaultPrefsFromAsset();

    const widLoadedFromProtocol = await handleProtocolUri();
    const widLoadedFromWebQuery = await applyLaunchParams(new URLSearchParams(window.location.search));
    const widLoaded = widLoadedFromProtocol || widLoadedFromWebQuery;

    // Set up Tauri event listeners before render (non-blocking for non-Tauri).
    if (runtime.isTauri) {
        await setupTauriListeners();
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
            <App />
        </StrictMode>,
    );
}

void start();
