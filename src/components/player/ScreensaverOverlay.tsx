/**
 * ScreensaverOverlay — full-screen "now playing" screensaver.
 *
 * Three styles: "minimal", "animated", "artwork"
 * All share: fade-in, wall clock, progress bar, dismiss on mousedown/keydown/touchstart.
 * Mouse *move* alone does NOT dismiss.
 */
import type { ScreensaverStyle } from "@/lib/uiSettings";
import { cn } from "@/lib/utils";
import type { MediaFile } from "@/types";
import type { PlayerMode } from "@/types";
import { MOOD_META } from "@/types/mood";
import type { MoodMode } from "@/types/mood";

import { useEffect, useState } from "react";

interface ScreensaverOverlayProps {
    media: MediaFile | null;
    mode: PlayerMode;
    currentTime: number;
    duration: number;
    style: ScreensaverStyle;
    onDismiss: () => void;
}

const MOOD_MODES = ["journey", "dock", "storm", "fest", "rock", "pop", "disco"] as const;

function isMoodMode(mode: PlayerMode): mode is MoodMode {
    return (MOOD_MODES as readonly string[]).includes(mode);
}

// function fmt(s: number): string {
//     if (!s || !isFinite(s)) return "0:00";
//     const h = Math.floor(s / 3600);
//     const m = Math.floor((s % 3600) / 60);
//     const sec = Math.floor(s % 60);
//     if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
//     return `${m}:${sec.toString().padStart(2, "0")}`;
// }

function useWallClock() {
    const [clock, setClock] = useState(() => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    });
    useEffect(() => {
        const id = setInterval(() => {
            const now = new Date();
            setClock(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }, 1000);
        return () => clearInterval(id);
    }, []);
    return clock;
}

// ── Shared shell ───────────────────────────────────────────────────────────

interface ShellProps {
    onDismiss: () => void;
    children: React.ReactNode;
    className?: string;
}

function Shell({ onDismiss, children, className }: ShellProps) {
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            onDismiss();
            e.stopPropagation();
        }
        function handleTouch() {
            onDismiss();
        }
        window.addEventListener("keydown", handleKey, true);
        window.addEventListener("touchstart", handleTouch, { passive: true });
        return () => {
            window.removeEventListener("keydown", handleKey, true);
            window.removeEventListener("touchstart", handleTouch);
        };
    }, [onDismiss]);

    return (
        <div
            className={cn("fixed inset-0 z-[100] animate-[screensaver-fadein_0.5s_ease_forwards]", className)}
            onMouseDown={onDismiss}
        >
            {children}
        </div>
    );
}

// ── Shared content (track name + channel + clock + progress bar) ───────────

interface ContentProps {
    media: MediaFile | null;
    mode: PlayerMode;
    currentTime: number;
    duration: number;
    clock: string;
    textClass?: string;
    mutedClass?: string;
}

function Content({ media, mode, currentTime, duration, clock, textClass, mutedClass }: ContentProps) {
    const moodLabel = isMoodMode(mode) ? (MOOD_META[mode as MoodMode]?.label ?? mode) : mode;
    const moodIcon = isMoodMode(mode) ? (MOOD_META[mode as MoodMode]?.icon ?? "♪") : "♪";

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <>
            {/* Wall clock */}
            <div
                className={cn(
                    "absolute right-6 top-5 font-mono text-sm tabular-nums",
                    mutedClass ?? "text-white/50",
                )}
            >
                {clock}
            </div>

            {/* Center content */}
            <div className="flex flex-col items-center justify-center gap-3 px-8 text-center">
                {/* Mood icon */}
                <div className={cn("text-5xl opacity-30", textClass ?? "text-white")} aria-hidden="true">
                    {moodIcon}
                </div>

                {/* Track name */}
                <div className={cn("max-w-xl text-4xl font-light leading-tight", textClass ?? "text-white")}>
                    {media?.name ?? "Nothing playing"}
                </div>

                {/* Channel / source */}
                {media && <div className={cn("text-base", mutedClass ?? "text-white/50")}>{moodLabel}</div>}
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                <div
                    className="h-full bg-[var(--color-player-accent)] transition-none"
                    style={{ width: `${Math.min(100, progress)}%` }}
                />
            </div>
        </>
    );
}

// ── Minimal style ──────────────────────────────────────────────────────────

function MinimalScreensaver(props: ScreensaverOverlayProps) {
    const clock = useWallClock();
    return (
        <Shell onDismiss={props.onDismiss} className="bg-black/95">
            {/* Radial glow */}
            <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{
                    background: "radial-gradient(circle, var(--color-player-accent) 0%, transparent 70%)",
                    opacity: 0.15,
                }}
            />
            <div className="relative flex h-full flex-col items-center justify-center">
                <Content {...props} clock={clock} />
            </div>
        </Shell>
    );
}

// ── Animated style ─────────────────────────────────────────────────────────

function AnimatedScreensaver(props: ScreensaverOverlayProps) {
    const clock = useWallClock();
    return (
        <Shell onDismiss={props.onDismiss} className="overflow-hidden bg-black/90">
            {/* Blob 1 */}
            <div
                className="pointer-events-none absolute rounded-full blur-3xl"
                style={{
                    width: 480,
                    height: 480,
                    top: "10%",
                    left: "15%",
                    background: "var(--color-player-accent)",
                    opacity: 0.18,
                    animation: "ss-blob1 16s ease-in-out infinite alternate",
                }}
            />
            {/* Blob 2 */}
            <div
                className="pointer-events-none absolute rounded-full blur-3xl"
                style={{
                    width: 380,
                    height: 380,
                    bottom: "12%",
                    right: "12%",
                    background: "var(--color-player-accent)",
                    opacity: 0.14,
                    animation: "ss-blob2 20s ease-in-out infinite alternate",
                }}
            />
            {/* Blob 3 */}
            <div
                className="pointer-events-none absolute rounded-full blur-3xl"
                style={{
                    width: 300,
                    height: 300,
                    top: "55%",
                    left: "55%",
                    background: "var(--color-player-accent)",
                    opacity: 0.1,
                    animation: "ss-blob3 12s ease-in-out infinite alternate",
                }}
            />

            <div className="relative flex h-full flex-col items-center justify-center">
                <Content {...props} clock={clock} />
            </div>
        </Shell>
    );
}

// ── Artwork style ──────────────────────────────────────────────────────────

function ArtworkScreensaver(props: ScreensaverOverlayProps) {
    const clock = useWallClock();
    const { media } = props;
    const youtubeId = media?.youtubeId;

    // Fall back to minimal if no YouTube thumbnail available
    if (!youtubeId) {
        return <MinimalScreensaver {...props} />;
    }

    const thumbUrl = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;
    const thumbFallback = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

    return (
        <Shell onDismiss={props.onDismiss} className="bg-black">
            {/* Blurred background */}
            <div
                className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center blur-xl"
                style={{
                    backgroundImage: `url(${thumbUrl}), url(${thumbFallback})`,
                    opacity: 0.4,
                }}
            />
            {/* Dark overlay */}
            <div className="pointer-events-none absolute inset-0 bg-black/60" />

            {/* Foreground card */}
            <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6">
                {/* Thumbnail card */}
                <img
                    src={thumbUrl}
                    onError={e => {
                        (e.target as HTMLImageElement).src = thumbFallback;
                    }}
                    alt={media?.name ?? ""}
                    className="max-h-48 max-w-xs rounded-xl object-cover shadow-2xl sm:max-h-56 sm:max-w-sm"
                />

                {/* Track info */}
                <div className="text-center">
                    <div className="max-w-lg text-2xl font-semibold text-white">{media?.name}</div>
                    <div className="mt-1 text-sm text-white/50">
                        {isMoodMode(props.mode)
                            ? (MOOD_META[props.mode as MoodMode]?.label ?? props.mode)
                            : props.mode}
                    </div>
                </div>

                {/* Wall clock */}
                <div className="absolute right-6 top-5 font-mono text-sm tabular-nums text-white/50">
                    {clock}
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                    <div
                        className="h-full bg-[var(--color-player-accent)] transition-none"
                        style={{
                            width: `${props.duration > 0 ? Math.min(100, (props.currentTime / props.duration) * 100) : 0}%`,
                        }}
                    />
                </div>
            </div>
        </Shell>
    );
}

// ── Main export ────────────────────────────────────────────────────────────

export function ScreensaverOverlay(props: ScreensaverOverlayProps) {
    switch (props.style) {
        case "minimal":
            return <MinimalScreensaver {...props} />;
        case "artwork":
            return <ArtworkScreensaver {...props} />;
        case "animated":
        default:
            return <AnimatedScreensaver {...props} />;
    }
}
