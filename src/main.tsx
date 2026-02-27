import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { parseMediaUrl } from "./lib/mediaSource";
import { bootstrapDefaultPrefsFromAsset, importPrefsFromUrl, readPrefs } from "./lib/moodDefaults";
import { nextWid } from "./lib/wid";
import { usePlayerStore } from "./stores";
import type { MediaFile, PlayerMode } from "./types";
import { MOOD_MODES } from "./types/mood";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}
const root = rootElement;

/**
 * Handle web+waldiez:// protocol invocations forwarded by the PWA manifest.
 * Chrome opens the installed app at `/?uri=web+waldiez://...`; we parse the
 * inner URI and dispatch based on the query params:
 *
 *   ?w=<url>   — fetch and apply a remote .wid / .waldiez config file
 *   ?src=<url> — add a media URL to the player library and play it
 *
 * Example links:
 *   web+waldiez://player?w=https://example.com/playlist.wid
 *   web+waldiez://player?src=https://example.com/audio.mp3
 *
 * Returns true when a .wid file was successfully loaded (so the caller can
 * re-apply the mood mode from the freshly written prefs).
 */
async function handleProtocolUri(): Promise<boolean> {
    const raw = new URLSearchParams(window.location.search).get("uri");
    if (!raw?.startsWith("web+waldiez://")) return false;
    try {
        const inner = new URL(raw.replace(/^web\+waldiez:\/\//, "https://waldiez.internal/"));

        // ?w= — load a remote .wid / .waldiez config file and apply its prefs
        const widUrl = inner.searchParams.get("w");
        if (widUrl) {
            return await importPrefsFromUrl(widUrl);
        }

        // ?src= — add a media URL to the library and set it as current
        const src = inner.searchParams.get("src");
        if (!src) return false;
        const parsed = parseMediaUrl(src);
        if (!parsed) return false;
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
        return false;
    } catch {
        // ignore malformed URIs
        return false;
    }
}

async function start() {
    await bootstrapDefaultPrefsFromAsset();

    const widLoaded = await handleProtocolUri();

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
