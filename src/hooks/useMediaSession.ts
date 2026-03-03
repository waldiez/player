/**
 * useMediaSession — syncs the Web Media Session API with the player state.
 * Provides lock-screen controls + headphone-button support on iOS/Android PWA.
 */
import { usePlayerStore } from "@/stores";
import { MOOD_META, MOOD_MODES } from "@/types/mood";

import { useEffect } from "react";

export function useMediaSession(): void {
    const { currentMedia, playback, playerMode, playerModeConfig } = usePlayerStore();
    const { togglePlay, playPrevInLibrary, playNextInLibrary, seek } = usePlayerStore.getState();

    // Update metadata when track changes
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;
        if (!currentMedia) {
            navigator.mediaSession.metadata = null;
            return;
        }

        const isMoodMode = (MOOD_MODES as string[]).includes(playerMode);
        // Try to derive artist label
        const artist = isMoodMode
            ? ((MOOD_META as Record<string, { label: string }>)[playerMode]?.label ?? "Wideria")
            : playerModeConfig.name;

        const artwork: MediaImage[] = currentMedia.thumbnailUrl
            ? [{ src: currentMedia.thumbnailUrl, sizes: "512x512", type: "image/jpeg" }]
            : [];

        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentMedia.name,
            artist,
            artwork,
        });
    }, [currentMedia, playerMode, playerModeConfig.name]);

    // Sync playback state
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;
        navigator.mediaSession.playbackState = playback.isPlaying ? "playing" : "paused";
    }, [playback.isPlaying]);

    const { duration, currentTime, playbackRate } = playback;

    // Sync position state
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;
        if (duration > 0 && isFinite(duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration,
                    position: Math.min(currentTime, duration),
                    playbackRate,
                });
            } catch {
                // Some browsers throw if values are invalid
            }
        }
    }, [duration, currentTime, playbackRate]);

    // Register action handlers once
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;

        const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
            ["play", () => togglePlay()],
            ["pause", () => togglePlay()],
            ["previoustrack", () => playPrevInLibrary()],
            ["nexttrack", () => playNextInLibrary()],
            [
                "seekbackward",
                (details: MediaSessionActionDetails) => {
                    const skip = details.seekOffset ?? 10;
                    seek(Math.max(0, playback.currentTime - skip));
                },
            ],
            [
                "seekforward",
                (details: MediaSessionActionDetails) => {
                    const skip = details.seekOffset ?? 10;
                    seek(Math.min(playback.duration, playback.currentTime + skip));
                },
            ],
        ];

        for (const [action, handler] of handlers) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch {
                // Not all actions are supported everywhere
            }
        }

        return () => {
            for (const [action] of handlers) {
                try {
                    navigator.mediaSession.setActionHandler(action, null);
                } catch {
                    // ignore
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
