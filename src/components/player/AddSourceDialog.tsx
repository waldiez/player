/**
 * AddSourceDialog — modal for adding a YouTube, Spotify, or HTTP stream URL
 * to the playlist.
 */
import { type UrlSourceType, isRtspUrl, parseMediaUrl } from "@/lib/mediaSource";
import { cn } from "@/lib/utils";
import { nextWid } from "@/lib/wid";
import { usePlayerStore } from "@/stores";
import type { MediaFile } from "@/types";

import { useState } from "react";

import { AlertTriangle, Globe, Plus, X } from "lucide-react";

interface AddSourceDialogProps {
    onClose: () => void;
}

const SOURCE_LABELS: Record<UrlSourceType, string> = {
    youtube: "YouTube",
    spotify: "Spotify",
    url: "Stream",
    file: "File",
};

const SOURCE_COLORS: Record<UrlSourceType, string> = {
    youtube: "bg-red-500/20 text-red-400",
    spotify: "bg-green-500/20 text-green-400",
    url: "bg-[var(--color-player-accent)]/20 text-[var(--color-player-accent)]",
    file: "",
};

export function AddSourceDialog({ onClose }: AddSourceDialogProps) {
    const [url, setUrl] = useState("");
    const [error, setError] = useState<string | null>(null);

    const { addToLibrary, setCurrentMedia } = usePlayerStore();

    const rtsp = isRtspUrl(url);
    const parsed = url.trim() ? parseMediaUrl(url) : null;

    function handleAdd() {
        if (rtsp) {
            setError(
                "RTSP is not playable in browsers. Use an HLS (.m3u8) URL or a direct HTTP audio link instead.",
            );
            return;
        }
        if (!parsed) {
            setError("Please enter a valid URL (YouTube, Spotify, or a direct HTTP audio/video link).");
            return;
        }
        const entry: MediaFile = {
            id: nextWid(),
            name: parsed.name,
            path: parsed.path,
            type: parsed.sourceType === "youtube" ? "video" : "audio",
            source: parsed.sourceType,
            embedUrl: parsed.embedUrl,
            youtubeId: parsed.youtubeId,
            playlistId: parsed.playlistId,
            duration: 0,
            size: 0,
            createdAt: new Date(),
        };
        addToLibrary(entry);
        setCurrentMedia(entry);
        onClose();
    }

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog */}
            <div className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-player-border)] bg-[var(--color-player-surface)] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--color-player-border)] px-5 py-3.5">
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-[var(--color-player-accent)]" />
                        <span className="font-semibold text-[var(--color-player-text)]">Add Source</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-[var(--color-player-text-muted)] transition-colors hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4 px-5 py-4">
                    {/* URL input */}
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--color-player-text-muted)]">
                            URL
                        </label>
                        <div className="relative">
                            <input
                                type="url"
                                autoFocus
                                placeholder="https://youtube.com/watch?v=… or Spotify / stream link"
                                value={url}
                                onChange={e => {
                                    setUrl(e.target.value);
                                    setError(null);
                                }}
                                onKeyDown={e => e.key === "Enter" && handleAdd()}
                                className={cn(
                                    "w-full rounded-lg border bg-[var(--color-player-bg)] px-3 py-2 pr-24",
                                    "text-sm text-[var(--color-player-text)] placeholder-[var(--color-player-text-muted)]",
                                    "outline-none transition-colors",
                                    "border-[var(--color-player-border)] focus:border-[var(--color-player-accent)]",
                                )}
                            />
                            {/* Detected source badge */}
                            {url.trim() && (
                                <span
                                    className={cn(
                                        "absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                        rtsp
                                            ? "bg-yellow-500/20 text-yellow-400"
                                            : parsed
                                              ? SOURCE_COLORS[parsed.sourceType]
                                              : "bg-red-500/20 text-red-400",
                                    )}
                                >
                                    {rtsp ? "RTSP" : parsed ? SOURCE_LABELS[parsed.sourceType] : "Invalid"}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* RTSP inline notice */}
                    {rtsp && !error && (
                        <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-400">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>
                                RTSP streams cannot be played directly in a browser. Try an HLS (.m3u8) URL or
                                a direct HTTP audio/video link instead.
                            </span>
                        </div>
                    )}

                    {/* Supported formats */}
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-player-text-muted)]">
                            Supported sources
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: "YouTube", sub: "youtube.com · youtu.be", color: "text-red-400" },
                                { label: "Spotify", sub: "open.spotify.com", color: "text-green-400" },
                                {
                                    label: "Stream URL",
                                    sub: "mp3 · ogg · m3u8 · flac",
                                    color: "text-[var(--color-player-accent)]",
                                },
                            ].map(s => (
                                <div
                                    key={s.label}
                                    className="rounded-lg border border-[var(--color-player-border)] px-2 py-2 text-center"
                                >
                                    <p className={cn("text-xs font-medium", s.color)}>{s.label}</p>
                                    <p className="mt-0.5 text-[10px] text-[var(--color-player-text-muted)]">
                                        {s.sub}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-[var(--color-player-border)] px-5 py-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-1.5 text-sm text-[var(--color-player-text-muted)] transition-colors hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={!parsed || rtsp}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-player-accent)] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add to Playlist
                    </button>
                </div>
            </div>
        </>
    );
}
