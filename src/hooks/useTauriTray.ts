/**
 * useTauriTray — syncs player state to the system tray and handles tray events.
 * No-ops when not running inside Tauri.
 */
import { isTauri, trayUpdateTrack } from "@/lib/tauriPlayer";
import { usePlayerStore } from "@/stores";

import { useEffect } from "react";

export function useTauriTray(): void {
    // Sync track + playing state to tray tooltip
    useEffect(() => {
        if (!isTauri()) return;
        return usePlayerStore.subscribe(state => {
            const name = state.currentMedia?.name ?? "";
            const isPlaying = state.playback.isPlaying;
            void trayUpdateTrack(name, isPlaying).catch(() => {});
        });
    }, []);

    // Listen to tray menu actions
    useEffect(() => {
        if (!isTauri()) return undefined;
        let unlisten: (() => void) | undefined;
        (async () => {
            try {
                const { listen } = await import("@tauri-apps/api/event");
                unlisten = await listen<string>("tray-action", event => {
                    const store = usePlayerStore.getState();
                    switch (event.payload) {
                        case "play-pause":
                            store.togglePlay();
                            break;
                        case "next":
                            store.playNextInLibrary();
                            break;
                        case "prev":
                            store.playPrevInLibrary();
                            break;
                        case "quit":
                            // Let the OS / Tauri handle quit
                            break;
                    }
                });
            } catch {
                // not in Tauri
            }
        })();
        return () => unlisten?.();
    }, []);
}
