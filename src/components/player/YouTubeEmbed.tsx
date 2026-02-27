/**
 * YouTubeEmbed — wraps the YouTube IFrame Player API.
 *
 * Bidirectional sync:
 *   Our controls → YT player:  play/pause, volume, mute, seek, playback rate
 *   YT player    → Our store:  play/pause state, current time, duration,
 *                              volume/mute changes from the native bottom bar
 *
 * Loads the YT script once (module-level singleton).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// ── Minimal YouTube IFrame API type shims ─────────────────────────────────
interface YTPlayerInstance {
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    getVolume(): number; // 0–100
    isMuted(): boolean;
    setVolume(volume: number): void; // 0–100
    mute(): void;
    unMute(): void;
    getPlaybackRate(): number;
    setPlaybackRate(rate: number): void;
    /** Returns metadata about the currently loaded video. */
    getVideoData(): { video_id: string; title: string; author: string };
    destroy(): void;
}

interface YTPlayerOptions {
    videoId: string;
    playerVars?: Record<string, number | string>;
    events?: {
        onReady?: (e: { target: YTPlayerInstance }) => void;
        onStateChange?: (e: { data: number }) => void;
    };
}

declare global {
    interface Window {
        YT?: {
            Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayerInstance;
            PlayerState: {
                UNSTARTED: number;
                ENDED: number;
                PLAYING: number;
                PAUSED: number;
                BUFFERING: number;
                CUED: number;
            };
        };
        onYouTubeIframeAPIReady?: () => void;
    }
}

// ── Singleton script loader ────────────────────────────────────────────────
let ytReady: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
    if (window.YT?.Player) return Promise.resolve();
    if (ytReady) return ytReady;
    ytReady = new Promise(resolve => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            prev?.();
            resolve();
        };
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
    });
    return ytReady;
}

// ── Component ─────────────────────────────────────────────────────────────

interface YouTubeEmbedProps {
    videoId: string;
    /** YouTube playlist ID. When set, playerVars include list+listType so the
     *  YT player handles playlist advancement internally. onEnded is suppressed
     *  between tracks (only fires when the user leaves the playlist entry). */
    playlistId?: string;
    isPlaying: boolean;
    volume: number; // 0–1
    isMuted: boolean;
    playbackRate: number;
    onStateChange: (playing: boolean) => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    /** Fired when the user changes volume/mute via YouTube's native controls. */
    onVolumeChange?: (volume: number, isMuted: boolean) => void;
    onEnded?: () => void;
    /** Fired when the playing video changes (playlist advancement or initial load).
     *  Provides the new video's title and YT video ID. */
    onVideoChange?: (title: string, videoId: string) => void;
    className?: string;
}

export interface YouTubeEmbedHandle {
    seekTo(seconds: number): void;
    playVideo(): void;
}

export const YouTubeEmbed = forwardRef<YouTubeEmbedHandle, YouTubeEmbedProps>(function YouTubeEmbedInner(
    {
        videoId,
        playlistId,
        isPlaying,
        volume,
        isMuted,
        playbackRate,
        onStateChange,
        onTimeUpdate,
        onVolumeChange,
        onEnded,
        onVideoChange,
        className,
    }: YouTubeEmbedProps,
    ref,
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Tracks the last known YT video ID so we can detect playlist advancement
    const lastVideoIdRef = useRef<string>("");

    // All callbacks + current prop values in one ref — avoids stale closures
    const cbRef = useRef({
        onStateChange,
        onTimeUpdate,
        onVolumeChange,
        onEnded,
        onVideoChange,
        volume,
        isMuted,
        playbackRate,
    });
    useEffect(() => {
        cbRef.current = {
            onStateChange,
            onTimeUpdate,
            onVolumeChange,
            onEnded,
            onVideoChange,
            volume,
            isMuted,
            playbackRate,
        };
    });

    // Track the last volume/mute we pushed to the YT player so we can
    // distinguish our own changes from user-initiated native-bar changes.
    // Stored in 0-1 scale to match the store / props.
    const lastPushedVolumeRef = useRef({ vol: volume, muted: isMuted });

    const isPlayingRef = useRef(isPlaying);
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useImperativeHandle(ref, () => ({
        seekTo(seconds: number) {
            playerRef.current?.seekTo(seconds, true);
        },
        playVideo() {
            playerRef.current?.playVideo();
        },
    }));

    // Keep playlistId in a ref to avoid stale closure in the player callbacks
    const playlistIdRef = useRef(playlistId);
    useEffect(() => {
        playlistIdRef.current = playlistId;
    }, [playlistId]);

    // ── Create / recreate player whenever videoId or playlistId changes ────
    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        let cancelled = false;

        loadYouTubeAPI().then(() => {
            if (cancelled || !el) return;

            playerRef.current?.destroy();
            playerRef.current = null;

            const listId = playlistIdRef.current;
            const playerVars: Record<string, number | string> = {
                autoplay: 0,
                controls: 1,
                rel: 0,
                modestbranding: 1,
                iv_load_policy: 3,
            };
            if (listId) {
                playerVars.list = listId;
                playerVars.listType = "playlist";
            }

            playerRef.current = new window.YT!.Player(el, {
                videoId: videoId || "",
                playerVars,
                events: {
                    onReady: ({ target }) => {
                        // Apply current volume/mute/rate on ready
                        const { volume: v, isMuted: m, playbackRate: r } = cbRef.current;
                        lastPushedVolumeRef.current = { vol: v, muted: m };
                        if (m) {
                            target.mute();
                        } else {
                            target.unMute();
                            target.setVolume(Math.round(v * 100));
                        }
                        target.setPlaybackRate(r);
                        if (isPlayingRef.current) target.playVideo();
                    },
                    onStateChange: ({ data }) => {
                        const S = window.YT!.PlayerState;
                        if (data === S.PLAYING) {
                            cbRef.current.onStateChange(true);

                            // Detect video change (playlist advancement or initial load)
                            try {
                                const vd = playerRef.current?.getVideoData();
                                if (vd?.video_id && vd.video_id !== lastVideoIdRef.current) {
                                    lastVideoIdRef.current = vd.video_id;
                                    if (vd.title) cbRef.current.onVideoChange?.(vd.title, vd.video_id);
                                }
                            } catch {
                                /* getVideoData not yet available */
                            }

                            if (tickRef.current) clearInterval(tickRef.current);
                            tickRef.current = setInterval(() => {
                                const p = playerRef.current;
                                if (!p) return;

                                // Time update
                                cbRef.current.onTimeUpdate?.(p.getCurrentTime(), p.getDuration());

                                // Volume sync: detect changes from YouTube's native controls
                                if (cbRef.current.onVolumeChange) {
                                    const ytVol = p.getVolume() / 100; // → 0-1
                                    const ytMuted = p.isMuted();
                                    const { vol: lastVol, muted: lastMuted } = lastPushedVolumeRef.current;
                                    if (Math.abs(ytVol - lastVol) > 0.02 || ytMuted !== lastMuted) {
                                        lastPushedVolumeRef.current = { vol: ytVol, muted: ytMuted };
                                        cbRef.current.onVolumeChange(ytVol, ytMuted);
                                    }
                                }
                            }, 500);
                        } else if (data === S.PAUSED) {
                            cbRef.current.onStateChange(false);
                            if (tickRef.current) {
                                clearInterval(tickRef.current);
                                tickRef.current = null;
                            }
                        } else if (data === S.ENDED) {
                            if (tickRef.current) {
                                clearInterval(tickRef.current);
                                tickRef.current = null;
                            }
                            if (playlistIdRef.current) {
                                // YT auto-advances internally — keep isPlaying=true so our
                                // pauseVideo effect does NOT fire and interrupt the transition.
                                // PLAYING will fire again when the next track starts.
                            } else {
                                cbRef.current.onStateChange(false);
                                cbRef.current.onEnded?.();
                            }
                        }
                    },
                },
            });
        });

        return () => {
            cancelled = true;
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
            playerRef.current?.destroy();
            playerRef.current = null;
        };
    }, [videoId, playlistId]);

    // ── Play / pause → YT player ──────────────────────────────────────────
    useEffect(() => {
        try {
            if (isPlaying) playerRef.current?.playVideo();
            else playerRef.current?.pauseVideo();
        } catch {
            /* player not ready — onReady handles initial play */
        }
    }, [isPlaying]);

    // ── Volume / mute → YT player ─────────────────────────────────────────
    useEffect(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
            lastPushedVolumeRef.current = { vol: volume, muted: isMuted };
            if (isMuted) {
                p.mute();
            } else {
                p.unMute();
                p.setVolume(Math.round(volume * 100));
            }
        } catch {
            /* not ready */
        }
    }, [volume, isMuted]);

    // ── Playback rate → YT player ─────────────────────────────────────────
    useEffect(() => {
        try {
            playerRef.current?.setPlaybackRate(playbackRate);
        } catch {
            /* not ready */
        }
    }, [playbackRate]);

    return (
        <div className={className ?? "h-full w-full"}>
            {/* YT API replaces this div's content with an <iframe> */}
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
});
