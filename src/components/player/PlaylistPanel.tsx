import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";
import type { MediaFile } from "@/types";

import { useState } from "react";

import { Globe, Headphones, Music, Music2, Plus, Video, X, Youtube } from "lucide-react";

import { AddSourceDialog } from "./AddSourceDialog";

function formatDuration(seconds: number): string {
    if (!seconds || !isFinite(seconds) || seconds === 0) return "--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function EqBars() {
    return (
        <span className="flex items-end gap-px" style={{ height: 14, width: 12 }}>
            <span
                className="w-1 rounded-sm bg-[var(--color-player-accent)]"
                style={{
                    height: "60%",
                    animation: "eq-bar 0.8s ease-in-out infinite",
                    animationDelay: "0ms",
                }}
            />
            <span
                className="w-1 rounded-sm bg-[var(--color-player-accent)]"
                style={{
                    height: "100%",
                    animation: "eq-bar 0.8s ease-in-out infinite",
                    animationDelay: "200ms",
                }}
            />
            <span
                className="w-1 rounded-sm bg-[var(--color-player-accent)]"
                style={{
                    height: "45%",
                    animation: "eq-bar 0.8s ease-in-out infinite",
                    animationDelay: "100ms",
                }}
            />
        </span>
    );
}

function TrackIcon({ item, isCurrent }: { item: MediaFile; isCurrent: boolean }) {
    const s = item.source ?? "file";
    if (s === "youtube") return <Youtube className="h-4 w-4 flex-shrink-0 text-red-400" />;
    if (s === "spotify") return <Headphones className="h-4 w-4 flex-shrink-0 text-green-400" />;
    if (s === "url")
        return (
            <Globe
                className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isCurrent ? "text-[var(--color-player-accent)]" : "text-[var(--color-player-text-muted)]",
                )}
            />
        );
    return item.type === "audio" ? (
        <Music2
            className={cn(
                "h-4 w-4 flex-shrink-0",
                isCurrent ? "text-[var(--color-player-accent)]" : "text-[var(--color-player-text-muted)]",
            )}
        />
    ) : (
        <Video
            className={cn(
                "h-4 w-4 flex-shrink-0",
                isCurrent ? "text-[var(--color-player-accent)]" : "text-[var(--color-player-text-muted)]",
            )}
        />
    );
}

export function PlaylistPanel() {
    const [showAddSource, setShowAddSource] = useState(false);
    const {
        mediaLibrary,
        currentMedia,
        playback,
        setCurrentMedia,
        setPlayback,
        removeFromLibrary,
        togglePlaylistPanel,
    } = usePlayerStore();

    function playTrack(item: MediaFile) {
        setCurrentMedia(item);
        setPlayback({ currentTime: 0, duration: 0, isPlaying: true });
    }

    const totalDuration = mediaLibrary.reduce((sum, m) => sum + (m.duration || 0), 0);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
                onClick={togglePlaylistPanel}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-l border-[var(--color-player-border)] bg-[var(--color-player-surface)] shadow-2xl animate-slide-right">
                {/* Header */}
                <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-player-border)] px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-[var(--color-player-accent)]" />
                        <span className="font-semibold text-[var(--color-player-text)]">Playlist</span>
                        <span className="rounded-full bg-[var(--color-player-border)] px-2 py-0.5 text-xs text-[var(--color-player-text-muted)]">
                            {mediaLibrary.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowAddSource(true)}
                            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[var(--color-player-accent)] transition-colors hover:bg-[var(--color-player-border)]"
                            aria-label="Add URL source"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            URL
                        </button>
                        <button
                            onClick={togglePlaylistPanel}
                            className="rounded-md p-1.5 text-[var(--color-player-text-muted)] transition-colors hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]"
                            aria-label="Close playlist"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Add-source dialog (rendered above the drawer) */}
                {showAddSource && <AddSourceDialog onClose={() => setShowAddSource(false)} />}

                {/* Track list */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {mediaLibrary.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Music className="mb-3 h-12 w-12 opacity-10 text-[var(--color-player-text)]" />
                            <p className="text-sm text-[var(--color-player-text-muted)]">No tracks yet</p>
                            <p className="mt-1 text-xs opacity-50 text-[var(--color-player-text-muted)]">
                                Drop files, or click "+ URL" for YouTube / Spotify
                            </p>
                        </div>
                    ) : (
                        <ul>
                            {mediaLibrary.map((item, idx) => {
                                const isCurrent = currentMedia?.id === item.id;
                                const isPlaying = isCurrent && playback.isPlaying;

                                return (
                                    <li key={item.id}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => playTrack(item)}
                                            onKeyDown={e => e.key === "Enter" && playTrack(item)}
                                            className={cn(
                                                "group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                                                "hover:bg-[var(--color-player-border)]",
                                                isCurrent &&
                                                    "bg-[color-mix(in_srgb,var(--color-player-accent)_12%,transparent)]",
                                            )}
                                        >
                                            {/* Index / eq bars */}
                                            <div className="flex w-5 flex-shrink-0 items-center justify-center">
                                                {isPlaying ? (
                                                    <EqBars />
                                                ) : (
                                                    <span
                                                        className={cn(
                                                            "text-xs tabular-nums",
                                                            isCurrent
                                                                ? "text-[var(--color-player-accent)]"
                                                                : "text-[var(--color-player-text-muted)]",
                                                        )}
                                                    >
                                                        {idx + 1}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Source/type icon */}
                                            <TrackIcon item={item} isCurrent={isCurrent} />

                                            {/* Name + duration */}
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className={cn(
                                                        "truncate text-sm leading-snug",
                                                        isCurrent
                                                            ? "font-medium text-[var(--color-player-accent)]"
                                                            : "text-[var(--color-player-text)]",
                                                    )}
                                                >
                                                    {item.name}
                                                </p>
                                                <p className="text-xs text-[var(--color-player-text-muted)]">
                                                    {formatDuration(item.duration)}
                                                </p>
                                            </div>

                                            {/* Remove */}
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    removeFromLibrary(item.id);
                                                }}
                                                className="flex-shrink-0 rounded p-1 text-[var(--color-player-text-muted)] opacity-40 transition-all hover:text-red-400 hover:opacity-100 group-hover:opacity-70"
                                                aria-label={`Remove ${item.name}`}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                {mediaLibrary.length > 0 && (
                    <div className="flex flex-shrink-0 items-center justify-between border-t border-[var(--color-player-border)] px-4 py-2.5">
                        <span className="text-xs text-[var(--color-player-text-muted)]">
                            {mediaLibrary.length} track{mediaLibrary.length !== 1 ? "s" : ""}
                            {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
                        </span>
                        <button
                            onClick={() => mediaLibrary.forEach(m => removeFromLibrary(m.id))}
                            className="text-xs text-[var(--color-player-text-muted)] transition-colors hover:text-red-400"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
