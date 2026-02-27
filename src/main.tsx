import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { parseMediaUrl } from "./lib/mediaSource";
import { bootstrapDefaultPrefsFromAsset, readPrefs } from "./lib/moodDefaults";
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
 * inner URI, extract `?src=<media-url>`, and queue it in the player store.
 *
 * Example link:  web+waldiez://player?src=https://example.com/audio.mp3
 */
function handleProtocolUri(): void {
    const raw = new URLSearchParams(window.location.search).get("uri");
    if (!raw?.startsWith("web+waldiez://")) return;
    try {
        const inner = new URL(raw.replace(/^web\+waldiez:\/\//, "https://waldiez.internal/"));
        const src = inner.searchParams.get("src");
        if (!src) return;
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
    } catch {
        // ignore malformed URIs
    }
}

async function start() {
    await bootstrapDefaultPrefsFromAsset();

    // On first visit (waldiez-player-storage absent), apply the mood mode written
    // by bootstrapDefaultPrefsFromAsset (from default.wid) to the Zustand store.
    // Without this the store's factory default "standard" stays active even though
    // wideria-prefs already contains e.g. mode: "journey".
    if (!localStorage.getItem("waldiez-player-storage")) {
        const prefs = readPrefs();
        const mode = typeof prefs?.mode === "string" ? prefs.mode : null;
        if (mode && (MOOD_MODES as readonly string[]).includes(mode)) {
            usePlayerStore.getState().setPlayerMode(mode as PlayerMode);
        }
    }

    handleProtocolUri();

    createRoot(root).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}

void start();
