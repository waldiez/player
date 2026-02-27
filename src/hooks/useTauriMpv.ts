/**
 * useTauriMpv — drives the Zustand player store from mpv IPC events.
 *
 * When active (isMpvMode = true), this hook:
 *   - Subscribes to "mpv-event" from the Tauri backend
 *   - Syncs currentTime, duration, isPlaying and volume into the store
 *   - Sends play/pause/seek/volume/speed commands to mpv whenever the
 *     corresponding store values change
 *
 * The hook is a no-op when running in a browser (no Tauri).
 */
import { listenMpvEvents, mpvPause, mpvResume, mpvSeek, mpvSetSpeed, mpvSetVolume } from "@/lib/tauriPlayer";
import { usePlayerStore } from "@/stores";

import { useEffect, useRef } from "react";

export function useTauriMpv(active: boolean, onEnded?: () => void) {
    const playback = usePlayerStore(s => s.playback);
    const setPlayback = usePlayerStore(s => s.setPlayback);

    // Refs to avoid stale closures in the event listener
    const playbackRef = useRef(playback);
    useEffect(() => {
        playbackRef.current = playback;
    });

    // ── Subscribe to mpv events ────────────────────────────────────────────
    useEffect(() => {
        if (!active) return;
        let unlisten: (() => void) | null = null;

        listenMpvEvents(evt => {
            switch (evt.type) {
                case "Time":
                    setPlayback({ currentTime: evt.value });
                    break;
                case "Duration":
                    setPlayback({ duration: evt.value });
                    break;
                case "Paused":
                    setPlayback({ isPlaying: !evt.value });
                    break;
                case "Volume":
                    setPlayback({ volume: evt.value });
                    break;
                case "Ended":
                    setPlayback({ isPlaying: false, currentTime: 0 });
                    onEnded?.();
                    break;
            }
        }).then(fn => {
            unlisten = fn;
        });

        return () => {
            unlisten?.();
        };
    }, [active, setPlayback, onEnded]);

    // ── Drive mpv from store changes ───────────────────────────────────────

    // play / pause
    useEffect(() => {
        if (!active) return;
        void (playback.isPlaying ? mpvResume() : mpvPause()).catch(() => {});
    }, [active, playback.isPlaying]);

    // seek (only when the diff is significant to avoid feedback loops)
    const lastMpvTimeRef = useRef(0);
    useEffect(() => {
        if (!active) return;
        const delta = Math.abs(playback.currentTime - lastMpvTimeRef.current);
        // Store gets time updates from mpv itself (~0.5 s resolution).
        // Only forward seeks initiated externally (> 1.5 s jump).
        if (delta > 1.5) {
            lastMpvTimeRef.current = playback.currentTime;
            void mpvSeek(playback.currentTime).catch(() => {});
        }
    }, [active, playback.currentTime]);

    // volume
    useEffect(() => {
        if (!active) return;
        void mpvSetVolume(playback.isMuted ? 0 : playback.volume).catch(() => {});
    }, [active, playback.volume, playback.isMuted]);

    // playback rate
    useEffect(() => {
        if (!active) return;
        void mpvSetSpeed(playback.playbackRate).catch(() => {});
    }, [active, playback.playbackRate]);
}
