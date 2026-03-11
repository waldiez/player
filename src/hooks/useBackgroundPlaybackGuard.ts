import { useEffect, useRef } from "react";

type BackgroundPlaybackGuardOptions = {
    pauseWhenHidden: boolean;
    isPlaying: boolean;
    onPauseForBackground: () => void;
    onResumeForeground: () => void;
};

export function useBackgroundPlaybackGuard({
    pauseWhenHidden,
    isPlaying,
    onPauseForBackground,
    onResumeForeground,
}: BackgroundPlaybackGuardOptions) {
    const autoPausedRef = useRef(false);
    const optionsRef = useRef({
        pauseWhenHidden,
        isPlaying,
        onPauseForBackground,
        onResumeForeground,
    });

    useEffect(() => {
        optionsRef.current = {
            pauseWhenHidden,
            isPlaying,
            onPauseForBackground,
            onResumeForeground,
        };
    }, [pauseWhenHidden, isPlaying, onPauseForBackground, onResumeForeground]);

    useEffect(() => {
        if (pauseWhenHidden) return;
        autoPausedRef.current = false;
    }, [pauseWhenHidden]);

    useEffect(() => {
        function syncVisibility() {
            const opts = optionsRef.current;
            if (document.hidden) {
                if (opts.pauseWhenHidden && opts.isPlaying) {
                    autoPausedRef.current = true;
                    opts.onPauseForBackground();
                }
                return;
            }

            if (autoPausedRef.current) {
                autoPausedRef.current = false;
                opts.onResumeForeground();
                return;
            }

            if (opts.isPlaying) {
                opts.onResumeForeground();
            }
        }

        document.addEventListener("visibilitychange", syncVisibility);
        window.addEventListener("focus", syncVisibility);
        window.addEventListener("pageshow", syncVisibility);

        return () => {
            document.removeEventListener("visibilitychange", syncVisibility);
            window.removeEventListener("focus", syncVisibility);
            window.removeEventListener("pageshow", syncVisibility);
        };
    }, []);
}
