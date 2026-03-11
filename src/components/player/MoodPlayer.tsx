/**
 * MoodPlayer — audio/video playback + canvas visualizer for mood modes.
 *
 * Source routing:
 *   • "file" / "url"  → hidden <audio> + Web Audio chain + MoodVisualizer
 *   • "youtube"       → YouTubeEmbed (IFrame API), no Web Audio chain
 *   • "spotify"       → Spotify embed <iframe>, no Web Audio chain
 *
 * Exposes MoodPlayerHandle.seekTo() via forwardRef so parent (App.tsx)
 * can forward scrubber / keyboard seeks to the YouTube player.
 */
import { useAudioChain } from "@/hooks/useAudioChain";
import { useBackgroundPlaybackGuard } from "@/hooks/useBackgroundPlaybackGuard";
import { extractYouTubeId } from "@/lib/mediaSource";
import { getPipedAudioUrl } from "@/lib/pipedPlayer";
import { getRuntimeContext } from "@/lib/runtime";
import { ytGetAudioUrl } from "@/lib/tauriPlayer";
import { usePlayerStore } from "@/stores";
import { EQ_PRESETS, MOOD_META } from "@/types/mood";
import type { MoodMode } from "@/types/mood";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { MoodVisualizer } from "./MoodVisualizer";
import { YouTubeEmbed } from "./YouTubeEmbed";
import type { YouTubeEmbedHandle } from "./YouTubeEmbed";

interface MoodPlayerProps {
    mode: MoodMode;
    className?: string;
    pausePlaybackWhenHidden?: boolean;
}

export interface MoodPlayerHandle {
    seekTo(time: number): void;
}

export const MoodPlayer = forwardRef<MoodPlayerHandle, MoodPlayerProps>(function MoodPlayerInner(
    { mode, className = "", pausePlaybackWhenHidden = false },
    ref,
) {
    const { currentMedia, playback, playerModeConfig, setPlayback, playNextInLibrary, repeatMode } =
        usePlayerStore();

    const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
    const isSeeking = useRef(false);
    const ytRef = useRef<YouTubeEmbedHandle>(null);
    const runtime = getRuntimeContext();
    const isTauriEnv = runtime.isTauri;
    const isTauriPackagedEnv = runtime.isPackagedDesktop;

    // Source type guards
    const src = currentMedia?.source ?? "file";
    const isYouTube = src === "youtube";
    const isSpotify = src === "spotify";
    // Derive YouTube video ID (from stored field or re-parsed from path)
    const ytId = currentMedia?.youtubeId ?? (currentMedia ? extractYouTubeId(currentMedia.path) : null);

    // Prefer direct native audio for YouTube (yt-dlp on Tauri, Piped in browser).
    // If extraction fails we fall back to the YouTube iframe player.
    const [nativeYtUrl, setNativeYtUrl] = useState<string | null>(null);
    const [nativeYtSource, setNativeYtSource] = useState<"piped" | "ytdlp" | null>(null);
    const triedDesktopPipedRef = useRef(false);
    const useNativeAudio = isYouTube && !!nativeYtUrl;
    const directVolumePath = useNativeAudio && nativeYtSource === "ytdlp";
    const useAudio = useNativeAudio || (!isYouTube && !isSpotify);

    useEffect(() => {
        if (!isYouTube || !ytId) {
            setNativeYtUrl(null);
            setNativeYtSource(null);
            triedDesktopPipedRef.current = false;
            return;
        }
        let cancelled = false;
        triedDesktopPipedRef.current = false;
        setNativeYtUrl(null);
        setNativeYtSource(null);
        (async () => {
            try {
                if (isTauriPackagedEnv) {
                    const piped = await getPipedAudioUrl(ytId);
                    if (!cancelled && piped) {
                        setNativeYtUrl(piped);
                        setNativeYtSource("piped");
                        return;
                    }
                    try {
                        const url = await ytGetAudioUrl(ytId);
                        if (!cancelled && url) {
                            setNativeYtUrl(url);
                            setNativeYtSource("ytdlp");
                        }
                        return;
                    } catch {
                        // handled below
                    }
                } else if (isTauriEnv) {
                    try {
                        const url = await ytGetAudioUrl(ytId);
                        if (!cancelled && url) {
                            setNativeYtUrl(url);
                            setNativeYtSource("ytdlp");
                        }
                        return;
                    } catch {
                        const piped = await getPipedAudioUrl(ytId);
                        if (!cancelled && piped) {
                            triedDesktopPipedRef.current = true;
                            setNativeYtUrl(piped);
                            setNativeYtSource("piped");
                            return;
                        }
                    }
                } else {
                    const piped = await getPipedAudioUrl(ytId);
                    if (!cancelled && piped) {
                        setNativeYtUrl(piped);
                        setNativeYtSource("piped");
                        return;
                    }
                }
                if (!cancelled) setNativeYtUrl(null);
            } catch {
                if (!cancelled) setNativeYtUrl(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isTauriEnv, isTauriPackagedEnv, isYouTube, ytId]);

    // Web Audio chain — only connected when we have an actual <audio> element
    const { init, resume, applyChain, setVolume, analyser } = useAudioChain(useAudio ? audioEl : null);

    // Expose seekTo so App.tsx scrubber can drive the YouTube player
    useImperativeHandle(ref, () => ({
        seekTo(time: number) {
            if (isYouTube) {
                ytRef.current?.seekTo(time);
            } else if (audioEl) {
                audioEl.currentTime = time;
            }
        },
    }));

    // ── Play / pause ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!audioEl || !useAudio) return;
        if (playback.isPlaying) {
            init();
            resume();
            audioEl.play().catch(() => {});
        } else {
            audioEl.pause();
        }
    }, [playback.isPlaying, audioEl, init, resume, useAudio]);

    const resumeForegroundPlayback = useCallback(() => {
        if (useAudio && audioEl) {
            init();
            resume();
            void audioEl.play().catch(() => {});
            return;
        }
        if (isYouTube && !useNativeAudio) {
            ytRef.current?.playVideo();
        }
    }, [audioEl, init, isYouTube, resume, useAudio, useNativeAudio]);

    const pauseForBackground = useCallback(() => {
        if (useAudio && audioEl) {
            audioEl.pause();
        }
        setPlayback({ isPlaying: false });
    }, [audioEl, setPlayback, useAudio]);

    useBackgroundPlaybackGuard({
        pauseWhenHidden: pausePlaybackWhenHidden,
        isPlaying: playback.isPlaying,
        onPauseForBackground: pauseForBackground,
        onResumeForeground: () => {
            if (!playback.isPlaying) {
                setPlayback({ isPlaying: true });
            }
            resumeForegroundPlayback();
        },
    });

    // If we switched from native YouTube audio back to iframe while playing,
    // ensure playback resumes in the embedded player.
    useEffect(() => {
        if (!isYouTube || useNativeAudio || !ytId || !playback.isPlaying) return;
        const t = setTimeout(() => {
            ytRef.current?.playVideo();
        }, 120);
        return () => clearTimeout(t);
    }, [isYouTube, useNativeAudio, ytId, playback.isPlaying]);

    // ── Volume ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (directVolumePath && audioEl) {
            audioEl.muted = playback.isMuted;
            audioEl.volume = playback.isMuted ? 0 : playback.volume;
            setVolume(1);
            return;
        }
        if (audioEl) audioEl.muted = false;
        setVolume(playback.isMuted ? 0 : playback.volume);
    }, [directVolumePath, playback.volume, playback.isMuted, setVolume, audioEl]);

    // ── Apply mood EQ preset on mode change ────────────────────────────────
    useEffect(() => {
        applyChain(EQ_PRESETS[MOOD_META[mode].defaultEQ]);
    }, [mode, applyChain]);

    // ── Seek ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!audioEl || isSeeking.current) return;
        if (Math.abs(audioEl.currentTime - playback.currentTime) > 0.5)
            audioEl.currentTime = playback.currentTime;
    }, [playback.currentTime, audioEl]);

    // ── Playback rate & loop ───────────────────────────────────────────────
    useEffect(() => {
        if (audioEl) audioEl.playbackRate = playback.playbackRate;
    }, [playback.playbackRate, audioEl]);
    // "one" → native loop; other modes handled by handleEnded
    useEffect(() => {
        if (audioEl) audioEl.loop = repeatMode === "one";
    }, [repeatMode, audioEl]);

    // ── Helpers ────────────────────────────────────────────────────────────
    function handleEnded() {
        if (repeatMode === "one") {
            if (isYouTube) {
                ytRef.current?.seekTo(0);
                setPlayback({ isPlaying: true, currentTime: 0 });
            }
            return;
        }
        if (playerModeConfig.behavior.autoAdvance) playNextInLibrary();
        else setPlayback({ isPlaying: false, currentTime: 0 });
    }

    return (
        <div className={`relative h-full w-full ${className}`}>
            {/* ── Local / stream audio element (hidden) ─────────────────── */}
            {useAudio && (
                <audio
                    ref={setAudioEl}
                    src={useNativeAudio ? (nativeYtUrl ?? undefined) : currentMedia?.path}
                    crossOrigin={useNativeAudio && nativeYtSource === "piped" ? "anonymous" : undefined}
                    onError={() => {
                        if (isYouTube && useNativeAudio) {
                            if (isTauriPackagedEnv && ytId && nativeYtSource === "piped") {
                                ytGetAudioUrl(ytId)
                                    .then(url => {
                                        if (url) {
                                            setNativeYtSource("ytdlp");
                                            setNativeYtUrl(url);
                                        } else {
                                            setNativeYtUrl(null);
                                        }
                                    })
                                    .catch(() => setNativeYtUrl(null));
                                return;
                            }
                            if (isTauriEnv && ytId && !triedDesktopPipedRef.current) {
                                triedDesktopPipedRef.current = true;
                                getPipedAudioUrl(ytId)
                                    .then(url => {
                                        if (url) {
                                            setNativeYtSource("piped");
                                            setNativeYtUrl(url);
                                        } else setNativeYtUrl(null);
                                    })
                                    .catch(() => setNativeYtUrl(null));
                                return;
                            }
                            setNativeYtUrl(null);
                        }
                    }}
                    onTimeUpdate={() => {
                        if (audioEl && !isSeeking.current) setPlayback({ currentTime: audioEl.currentTime });
                    }}
                    onLoadedMetadata={() => {
                        if (audioEl) setPlayback({ duration: audioEl.duration });
                    }}
                    onEnded={handleEnded}
                    onSeeking={() => {
                        isSeeking.current = true;
                    }}
                    onSeeked={() => {
                        isSeeking.current = false;
                        if (audioEl) setPlayback({ currentTime: audioEl.currentTime });
                    }}
                />
            )}

            {/* ── Visualiser area ───────────────────────────────────────── */}
            {!currentMedia ? (
                <div className="flex h-full items-center justify-center text-player-text-muted">
                    <div className="text-center">
                        <div className="mb-4 text-5xl opacity-20">♫</div>
                        <p className="text-lg">No audio loaded</p>
                        <p className="mt-2 text-sm opacity-60">
                            Drop a file, or add a YouTube / Spotify / stream URL
                        </p>
                    </div>
                </div>
            ) : isYouTube && ytId && !useNativeAudio && !isTauriPackagedEnv ? (
                <YouTubeEmbed
                    ref={ytRef}
                    videoId={ytId}
                    isPlaying={playback.isPlaying}
                    volume={playback.volume}
                    isMuted={playback.isMuted}
                    playbackRate={playback.playbackRate}
                    onStateChange={playing => setPlayback({ isPlaying: playing })}
                    onTimeUpdate={(time, dur) => setPlayback({ currentTime: time, duration: dur })}
                    onVolumeChange={(vol, muted) => setPlayback({ volume: vol, isMuted: muted })}
                    onEnded={handleEnded}
                    className="absolute inset-0 h-full w-full"
                />
            ) : isYouTube && ytId && !useNativeAudio && isTauriPackagedEnv ? (
                <div className="flex h-full items-center justify-center text-player-text-muted">
                    <div className="text-center">
                        <p className="text-sm font-medium">Unable to load YouTube stream</p>
                        <p className="mt-2 text-xs opacity-70">
                            Frontend and backend stream attempts failed. IFrame fallback is disabled in
                            packaged desktop mode to avoid YouTube Error 153.
                        </p>
                    </div>
                </div>
            ) : isSpotify && currentMedia.embedUrl ? (
                <iframe
                    src={currentMedia.embedUrl}
                    title="Spotify player"
                    className="absolute inset-0 h-full w-full rounded"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                />
            ) : (
                /* File / URL — show waveform visualizer */
                <MoodVisualizer mode={mode} analyser={analyser} isPlaying={playback.isPlaying} />
            )}
        </div>
    );
});
