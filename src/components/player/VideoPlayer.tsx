import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

import { useCallback, useEffect, useRef } from "react";

interface VideoPlayerProps {
    className?: string;
}

export function VideoPlayer({ className }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isSeeking = useRef(false);

    const { currentMedia, playback, setPlayback, effects } = usePlayerStore();

    // Sync play/pause state
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentMedia) return;

        if (playback.isPlaying) {
            video.play().catch(console.error);
        } else {
            video.pause();
        }
    }, [playback.isPlaying, currentMedia]);

    // Sync volume
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = playback.isMuted ? 0 : playback.volume;
    }, [playback.volume, playback.isMuted]);

    // Sync playback rate
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = playback.playbackRate;
    }, [playback.playbackRate]);

    // Sync loop
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.loop = playback.isLooping;
    }, [playback.isLooping]);

    // Sync seek - this is the key fix!
    // We need to detect when currentTime changes from the store (user seeking)
    // vs when it changes from the video playing
    useEffect(() => {
        const video = videoRef.current;
        if (!video || isSeeking.current) return;

        // Only seek if the difference is significant (user initiated seek)
        const timeDiff = Math.abs(video.currentTime - playback.currentTime);
        if (timeDiff > 0.5) {
            video.currentTime = playback.currentTime;
        }
    }, [playback.currentTime]);

    // Handle time updates from video
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video || isSeeking.current) return;
        setPlayback({ currentTime: video.currentTime });
    }, [setPlayback]);

    // Handle seeking events
    const handleSeeking = useCallback(() => {
        isSeeking.current = true;
    }, []);

    const handleSeeked = useCallback(() => {
        isSeeking.current = false;
        const video = videoRef.current;
        if (video) {
            setPlayback({ currentTime: video.currentTime });
        }
    }, [setPlayback]);

    const handleLoadedMetadata = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        setPlayback({
            duration: video.duration,
            currentTime: 0,
        });
    }, [setPlayback]);

    const handleEnded = useCallback(() => {
        if (!playback.isLooping) {
            setPlayback({ isPlaying: false });
        }
    }, [playback.isLooping, setPlayback]);

    // Handle fullscreen
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleFullscreenChange = () => {
            const isFullscreen = !!document.fullscreenElement;
            setPlayback({ isFullscreen });
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [setPlayback]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        if (playback.isFullscreen && !document.fullscreenElement) {
            container.requestFullscreen?.().catch(console.error);
        } else if (!playback.isFullscreen && document.fullscreenElement) {
            document.exitFullscreen?.().catch(console.error);
        }
    }, [playback.isFullscreen]);

    // Handle click to play/pause
    const handleVideoClick = useCallback(() => {
        usePlayerStore.getState().togglePlay();
    }, []);

    // Handle double-click for fullscreen
    const handleDoubleClick = useCallback(() => {
        usePlayerStore.getState().toggleFullscreen();
    }, []);

    // Build CSS filter string from effects
    const filterString = effects
        .filter(e => e.enabled)
        .map(effect => {
            switch (effect.type) {
                case "brightness":
                    return `brightness(${effect.parameters["value"] ?? 1})`;
                case "contrast":
                    return `contrast(${effect.parameters["value"] ?? 1})`;
                case "saturation":
                    return `saturate(${effect.parameters["value"] ?? 1})`;
                case "hue":
                    return `hue-rotate(${effect.parameters["value"] ?? 0}deg)`;
                case "blur":
                    return `blur(${effect.parameters["value"] ?? 0}px)`;
                case "vignette":
                    // Vignette needs special handling with pseudo-elements
                    return "";
                default:
                    return "";
            }
        })
        .filter(Boolean)
        .join(" ");

    if (!currentMedia) {
        return (
            <div
                ref={containerRef}
                className={cn("flex items-center justify-center bg-black text-player-text-muted", className)}
            >
                <div className="text-center">
                    <div className="mb-4 text-6xl opacity-20">🎬</div>
                    <p className="text-lg">No media loaded</p>
                    <p className="mt-2 text-sm">Drag and drop a video file or click to browse</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={cn("relative bg-black", className)}>
            <video
                ref={videoRef}
                className="h-full w-full cursor-pointer object-contain"
                src={currentMedia.path}
                style={{ filter: filterString || undefined }}
                onClick={handleVideoClick}
                onDoubleClick={handleDoubleClick}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onSeeking={handleSeeking}
                onSeeked={handleSeeked}
                playsInline
            />

            {/* Vignette overlay */}
            {effects.some(e => e.type === "vignette" && e.enabled) && (
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(ellipse at center, transparent 0%, transparent ${
                            ((effects.find(e => e.type === "vignette")?.parameters["radius"] as number) ??
                                0.5) * 100
                        }%, rgba(0,0,0,${
                            effects.find(e => e.type === "vignette")?.parameters["intensity"] ?? 0
                        }) 100%)`,
                    }}
                />
            )}
        </div>
    );
}
