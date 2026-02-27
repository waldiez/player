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
import { extractYouTubeId } from "@/lib/mediaSource";
import { usePlayerStore } from "@/stores";
import { EQ_PRESETS, MOOD_META } from "@/types/mood";
import type { MoodMode } from "@/types/mood";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { MoodVisualizer } from "./MoodVisualizer";
import { YouTubeEmbed } from "./YouTubeEmbed";
import type { YouTubeEmbedHandle } from "./YouTubeEmbed";

interface MoodPlayerProps {
    mode: MoodMode;
    className?: string;
}

export interface MoodPlayerHandle {
    seekTo(time: number): void;
}

export const MoodPlayer = forwardRef<MoodPlayerHandle, MoodPlayerProps>(function MoodPlayerInner(
    { mode, className = "" },
    ref,
) {
    const { currentMedia, playback, playerModeConfig, setPlayback, playNextInLibrary, repeatMode } =
        usePlayerStore();

    const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
    const isSeeking = useRef(false);
    const ytRef = useRef<YouTubeEmbedHandle>(null);

    // Source type guards
    const src = currentMedia?.source ?? "file";
    const isYouTube = src === "youtube";
    const isSpotify = src === "spotify";
    const useAudio = !isYouTube && !isSpotify;

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

    // ── Volume ─────────────────────────────────────────────────────────────
    useEffect(() => {
        setVolume(playback.isMuted ? 0 : playback.volume);
    }, [playback.volume, playback.isMuted, setVolume]);

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

    // Derive YouTube video ID (from stored field or re-parsed from path)
    const ytId = currentMedia?.youtubeId ?? (currentMedia ? extractYouTubeId(currentMedia.path) : null);

    return (
        <div className={`relative h-full w-full ${className}`}>
            {/* ── Local / stream audio element (hidden) ─────────────────── */}
            {useAudio && (
                <audio
                    ref={setAudioEl}
                    src={currentMedia?.path}
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
            ) : isYouTube && ytId ? (
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
