/**
 * useMoodPersistence — per-mode playlist loading + auto-save for mood modes.
 *
 * On `mode` change:
 *   1. Reads wideria-prefs for saved session tracks → loads them
 *   2. Falls back to user-saved defaults
 *   3. Falls back to hardcoded MODE_DEFAULTS from kideria/web/player.js
 *   4. Resolves "YouTube · ID" placeholder names via oEmbed (background)
 *
 * Auto-saves to wideria-prefs whenever the library changes (debounced 500ms).
 *
 * Returns:
 *   saveAsDefault() — saves the current playlist as the user-defined default
 *   for the current mode (mirrors kideria's "★ Save as default" button).
 */
import {
    fetchYouTubeTitle,
    loadModeTracklist,
    saveDefaultForMode,
    saveModeTracksToPrefs,
} from "@/lib/moodDefaults";
import { usePlayerStore } from "@/stores";
import type { MoodMode } from "@/types/mood";

import { useCallback, useEffect, useRef } from "react";

const DEBOUNCE_MS = 500;

export function useMoodPersistence(mode: MoodMode) {
    const modeRef = useRef(mode);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Prevents the load-triggered library change from starting a save cycle
    const isLoading = useRef(false);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    // ── Load tracklist on mode change ──────────────────────────────────────
    useEffect(() => {
        const store = usePlayerStore.getState();

        // Pause playback before switching so the previous track doesn't keep playing
        store.setPlayback({ isPlaying: false, currentTime: 0, duration: 0 });

        const { files, currentId } = loadModeTracklist(mode);

        isLoading.current = true;
        store.setMediaLibrary(files);
        // setMediaLibrary is synchronous in Zustand, so we can reset immediately
        isLoading.current = false;

        // Restore last-playing track; fall back to first track in playlist
        if (currentId) {
            const match = files.find(f => f.youtubeId === currentId);
            store.setCurrentMedia(match ?? files[0] ?? null);
        } else {
            store.setCurrentMedia(files[0] ?? null);
        }

        // Background: resolve "YouTube · ID" → actual video title via oEmbed
        files.forEach((file, idx) => {
            if (file.source === "youtube" && file.youtubeId && file.name.startsWith("YouTube · ")) {
                fetchYouTubeTitle(file.youtubeId).then(title => {
                    if (!title) return;
                    // Update just that entry's name in the current library
                    const lib = usePlayerStore.getState().mediaLibrary;
                    const updated = lib.map((f, i) =>
                        i === idx && f.id === file.id ? { ...f, name: title } : f,
                    );
                    usePlayerStore.getState().setMediaLibrary(updated);
                });
            }
        });
    }, [mode]);

    // ── Subscribe to library changes and auto-save ─────────────────────────
    useEffect(() => {
        const unsub = usePlayerStore.subscribe(_state => {
            if (isLoading.current) return;

            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                const { mediaLibrary, currentMedia, playback } = usePlayerStore.getState();
                saveModeTracksToPrefs(modeRef.current, mediaLibrary, currentMedia, {
                    volume: playback.volume,
                    muted: playback.isMuted,
                });
            }, DEBOUNCE_MS);
        });

        return () => {
            unsub();
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, []);

    // ── Reload tracklist from prefs (e.g. after import) ───────────────────
    const reloadTracklist = useCallback(() => {
        const store = usePlayerStore.getState();
        const m = modeRef.current;
        const { files, currentId } = loadModeTracklist(m);

        isLoading.current = true;
        store.setMediaLibrary(files);
        isLoading.current = false;

        if (currentId) {
            const match = files.find(f => f.youtubeId === currentId);
            store.setCurrentMedia(match ?? files[0] ?? null);
        } else {
            store.setCurrentMedia(files[0] ?? null);
        }

        files.forEach((file, idx) => {
            if (file.source === "youtube" && file.youtubeId && file.name.startsWith("YouTube · ")) {
                fetchYouTubeTitle(file.youtubeId).then(title => {
                    if (!title) return;
                    const lib = usePlayerStore.getState().mediaLibrary;
                    const updated = lib.map((f, i) =>
                        i === idx && f.id === file.id ? { ...f, name: title } : f,
                    );
                    usePlayerStore.getState().setMediaLibrary(updated);
                });
            }
        });
    }, []);

    // ── Save as default ────────────────────────────────────────────────────
    const saveAsDefault = useCallback(() => {
        saveDefaultForMode(modeRef.current, usePlayerStore.getState().mediaLibrary);
    }, []);

    return { saveAsDefault, reloadTracklist };
}
