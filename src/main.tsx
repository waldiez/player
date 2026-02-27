import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { bootstrapDefaultPrefsFromAsset, readPrefs } from "./lib/moodDefaults";
import { usePlayerStore } from "./stores";
import type { PlayerMode } from "./types";
import { MOOD_MODES } from "./types/mood";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}
const root = rootElement;

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

    createRoot(root).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}

void start();
