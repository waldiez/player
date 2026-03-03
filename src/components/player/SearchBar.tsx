/**
 * SearchBar — collapsible multi-source search.
 *
 * Sources:
 *   YouTube   — keyword search via backend / YouTube Data API (if key) / public fallbacks
 *   SoundCloud — full keyword search via unofficial SC v2 API
 *   Spotify   — URL-paste only (no public search API without OAuth)
 *
 * Layout:
 *   md+ screens : expands inline in header; results float below
 *   xs/sm       : full-screen modal (mirrors AddSourceDialog)
 *
 * URL passthrough: any https:// URL in any tab → parseMediaUrl() directly.
 * Keyboard: ArrowUp/Down cycles results, Escape closes.
 */
import { parseMediaUrl } from "@/lib/mediaSource";
import { type SoundCloudSearchResult, searchSoundCloud } from "@/lib/soundcloudSearch";
import { detectPlatformFromUrl, launchInApp } from "@/lib/streamingLaunchers";
import { cn } from "@/lib/utils";
import { nextWid } from "@/lib/wid";
import { type YouTubeSearchResult, getLastYouTubeSearchError, searchYouTube } from "@/lib/youtubeSearch";
import type { MediaFile } from "@/types";

import { useEffect, useRef, useState } from "react";

import { Loader2, Search, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type SearchSource = "youtube" | "soundcloud" | "spotify";

interface SearchBarProps {
    onAdd: (entry: MediaFile) => void;
    className?: string;
}

/** Unified result shape used by the shared result list. */
interface SearchResult {
    key: string;
    title: string;
    subtitle: string;
    thumbnail: string;
    duration: number; // seconds
    source: SearchSource;
    // raw payload — only one will be set
    yt?: YouTubeSearchResult;
    sc?: SoundCloudSearchResult;
    urlEntry?: MediaFile; // for URL passthrough
}

// ── Source tab config ──────────────────────────────────────────────────────

const TABS: { id: SearchSource; label: string; short: string; color: string }[] = [
    { id: "youtube", label: "YouTube", short: "YT", color: "text-red-400" },
    { id: "soundcloud", label: "SoundCloud", short: "SC", color: "text-orange-400" },
    { id: "spotify", label: "Spotify", short: "SP", color: "text-green-400" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildMediaEntryFromUrl(url: string): MediaFile | null {
    const parsed = parseMediaUrl(url);
    if (!parsed) return null;
    return {
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
}

function buildYtEntry(r: YouTubeSearchResult): MediaFile {
    const ytUrl = `https://www.youtube.com/watch?v=${r.videoId}`;
    const parsed = parseMediaUrl(ytUrl);
    return {
        id: nextWid(),
        name: r.title || parsed?.name || `YouTube — ${r.videoId}`,
        path: ytUrl,
        type: "video",
        source: "youtube",
        embedUrl: parsed?.embedUrl,
        youtubeId: r.videoId,
        duration: r.duration,
        size: 0,
        createdAt: new Date(),
    };
}

function buildScEntry(r: SoundCloudSearchResult): MediaFile {
    return {
        id: nextWid(),
        name: r.title,
        path: r.trackUrl,
        type: "audio",
        source: "soundcloud",
        embedUrl: r.embedUrl,
        duration: r.duration,
        size: 0,
        createdAt: new Date(),
    };
}

// ── Source tabs (shared between modal and inline) ──────────────────────────

function SourceTabs({
    active,
    onChange,
    size = "sm",
}: {
    active: SearchSource;
    onChange: (s: SearchSource) => void;
    size?: "sm" | "xs";
}) {
    return (
        <div className="flex items-center gap-1">
            {TABS.map(t => (
                <button
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    className={cn(
                        "rounded px-2 transition-colors",
                        size === "sm" ? "py-1 text-xs" : "py-0.5 text-[11px]",
                        active === t.id
                            ? cn("font-semibold", t.color, "bg-[var(--color-player-border)]")
                            : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                    )}
                >
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.short}</span>
                </button>
            ))}
        </div>
    );
}

// ── Spotify URL-only panel ─────────────────────────────────────────────────

function SpotifyPanel({
    query,
    setQuery,
    inputRef,
    onAdd,
    onClose,
    size = "sm",
}: {
    query: string;
    setQuery: (q: string) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onAdd: (e: MediaFile) => void;
    onClose: () => void;
    size?: "sm" | "lg";
}) {
    const parsed = query.trim().startsWith("https://open.spotify.com")
        ? buildMediaEntryFromUrl(query.trim())
        : null;

    return (
        <div className={size === "lg" ? "flex flex-col gap-3 p-4" : "flex flex-col gap-2"}>
            <input
                ref={inputRef}
                type="text"
                placeholder="Paste a Spotify track, album, or playlist URL…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "Escape") onClose();
                    if (e.key === "Enter" && parsed) {
                        onAdd(parsed);
                        onClose();
                    }
                }}
                className={cn(
                    "w-full rounded border border-[var(--color-player-border)] bg-[var(--color-player-bg)]",
                    "text-[var(--color-player-text)] placeholder-[var(--color-player-text-muted)] outline-none",
                    "focus:border-green-500",
                    size === "lg" ? "px-3 py-2 text-sm" : "px-2.5 py-1 text-xs",
                )}
            />
            {parsed ? (
                <button
                    onClick={() => {
                        onAdd(parsed);
                        onClose();
                    }}
                    className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                >
                    Add: {parsed.name}
                </button>
            ) : (
                <p className="text-[11px] text-[var(--color-player-text-muted)]">
                    Spotify search requires login — paste a link above to add it directly.
                </p>
            )}
        </div>
    );
}

// ── Result list ─────────────────────────────────────────────────────────────

interface ResultListProps {
    results: SearchResult[];
    query: string;
    isLoading: boolean;
    activeIndex: number;
    onSelect: (r: SearchResult) => void;
    source: SearchSource;
    emptyHint?: string;
}

function ResultList({
    results,
    query,
    isLoading,
    activeIndex,
    onSelect,
    source,
    emptyHint,
}: ResultListProps) {
    const q = query.trim();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-[var(--color-player-text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
            </div>
        );
    }

    if (results.length === 0) {
        if (q.length > 1 && source !== "spotify") {
            return (
                <div className="px-4 py-6 text-center text-xs text-[var(--color-player-text-muted)]">
                    {emptyHint || "No results found"}
                </div>
            );
        }
        return null;
    }

    return (
        <ul>
            {results.map((r, i) => (
                <li key={r.key}>
                    <button
                        onClick={() => onSelect(r)}
                        className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                            i === activeIndex
                                ? "bg-[var(--color-player-accent)]/20"
                                : "hover:bg-[var(--color-player-border)]",
                        )}
                    >
                        {r.thumbnail ? (
                            <img
                                src={r.thumbnail}
                                alt=""
                                loading="lazy"
                                className="h-10 w-16 shrink-0 rounded object-cover"
                            />
                        ) : (
                            <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-[var(--color-player-border)]">
                                <Search className="h-4 w-4 text-[var(--color-player-text-muted)]" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-[var(--color-player-text)]">
                                {r.title}
                            </div>
                            <div className="truncate text-[11px] text-[var(--color-player-text-muted)]">
                                {r.subtitle}
                            </div>
                        </div>
                        {r.duration > 0 && (
                            <span className="shrink-0 text-[11px] text-[var(--color-player-text-muted)]">
                                {formatDuration(r.duration)}
                            </span>
                        )}
                    </button>
                </li>
            ))}
        </ul>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SearchBar({ onAdd, className }: SearchBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [source, setSource] = useState<SearchSource>("youtube");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [emptyHint, setEmptyHint] = useState("");
    const [isMedium, setIsMedium] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 768px)");
        const handler = (e: MediaQueryListEvent) => setIsMedium(e.matches);
        mq.addEventListener("change", handler);
        setIsMedium(mq.matches);
        return () => mq.removeEventListener("change", handler);
    }, []);

    // Reset query when tab changes (but keep open)
    useEffect(() => {
        setQuery("");
        setResults([]);
        setActiveIndex(-1);
        setEmptyHint("");
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [source]);

    // Focus + reset when toggled
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery("");
            setResults([]);
            setActiveIndex(-1);
            setEmptyHint("");
        }
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!isOpen || source === "spotify") return;

        const q = query.trim();

        // URL passthrough — works in any tab
        if (q.startsWith("http://") || q.startsWith("https://")) {
            const entry = buildMediaEntryFromUrl(q);
            if (entry) {
                setResults([
                    {
                        key: "url",
                        title: entry.name,
                        subtitle: entry.source ?? "",
                        thumbnail: "",
                        duration: 0,
                        source: source,
                        urlEntry: entry,
                    },
                ]);
                setEmptyHint("");
            } else {
                setResults([]);
            }
            setActiveIndex(-1);
            return;
        }

        if (q.length <= 1) {
            setResults([]);
            setEmptyHint("");
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                if (source === "youtube") {
                    const found = await searchYouTube(q);
                    setResults(
                        found.map(r => ({
                            key: r.videoId,
                            title: r.title,
                            subtitle: r.channelName,
                            thumbnail: r.thumbnail,
                            duration: r.duration,
                            source: "youtube" as SearchSource,
                            yt: r,
                        })),
                    );
                    setEmptyHint(found.length === 0 ? getLastYouTubeSearchError() : "");
                } else if (source === "soundcloud") {
                    const found = await searchSoundCloud(q);
                    setResults(
                        found.map(r => ({
                            key: String(r.id),
                            title: r.title,
                            subtitle: r.userName,
                            thumbnail: r.thumbnail,
                            duration: r.duration,
                            source: "soundcloud" as SearchSource,
                            sc: r,
                        })),
                    );
                    setEmptyHint("");
                }
                setActiveIndex(-1);
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(debounceRef.current);
    }, [query, source, isOpen]);

    function handleSelect(r: SearchResult) {
        let entry: MediaFile | null = null;
        if (r.urlEntry) {
            entry = r.urlEntry;
        } else if (r.yt) {
            entry = buildYtEntry(r.yt);
        } else if (r.sc) {
            entry = buildScEntry(r.sc);
        }
        if (entry) {
            onAdd(entry);
            setIsOpen(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Escape") {
            setIsOpen(false);
            return;
        }
        if (results.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            const r = results[activeIndex];
            if (r) handleSelect(r);
        }
    }

    const placeholder =
        source === "soundcloud"
            ? "Search SoundCloud or paste URL…"
            : source === "spotify"
              ? "Paste a Spotify URL…"
              : "Search YouTube or paste URL…";

    // ── Mobile: full-screen modal ────────────────────────────────────────
    if (isOpen && !isMedium) {
        return (
            <>
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
                <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-player-bg)]">
                    {/* Header row */}
                    <div className="flex items-center gap-2 border-b border-[var(--color-player-border)] px-4 py-3">
                        <Search className="h-4 w-4 shrink-0 text-[var(--color-player-accent)]" />
                        {source !== "spotify" && (
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={placeholder}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="flex-1 bg-transparent text-sm text-[var(--color-player-text)] placeholder-[var(--color-player-text-muted)] outline-none"
                            />
                        )}
                        {source === "spotify" && (
                            <span className="flex-1 text-sm text-[var(--color-player-text-muted)]">
                                Spotify
                            </span>
                        )}
                        {isLoading && (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-player-text-muted)]" />
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="rounded p-1 text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]"
                            aria-label="Close search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Source tabs */}
                    <div className="border-b border-[var(--color-player-border)] px-4 py-2">
                        <SourceTabs active={source} onChange={s => setSource(s)} size="sm" />
                    </div>

                    {/* Streaming "Open in App" button (mobile) */}
                    {(() => {
                        const q = query.trim();
                        if (!q.startsWith("http")) return null;
                        const platform = detectPlatformFromUrl(q);
                        if (!platform) return null;
                        return (
                            <div className="border-b border-[var(--color-player-border)] p-3">
                                <button
                                    onClick={() => void launchInApp(platform, q)}
                                    className="flex w-full items-center gap-2 rounded-lg bg-player-accent px-3 py-2.5 text-sm font-medium text-white hover:opacity-90"
                                >
                                    <span>{platform.icon}</span>
                                    Open in {platform.name}
                                </button>
                            </div>
                        );
                    })()}

                    {/* Results / Spotify panel */}
                    <div className="flex-1 overflow-y-auto">
                        {source === "spotify" ? (
                            <SpotifyPanel
                                query={query}
                                setQuery={setQuery}
                                inputRef={inputRef}
                                onAdd={onAdd}
                                onClose={() => setIsOpen(false)}
                                size="lg"
                            />
                        ) : (
                            <ResultList
                                results={results}
                                query={query}
                                isLoading={isLoading}
                                activeIndex={activeIndex}
                                onSelect={handleSelect}
                                source={source}
                                emptyHint={emptyHint}
                            />
                        )}
                    </div>
                </div>
            </>
        );
    }

    // ── Desktop: inline ──────────────────────────────────────────────────
    return (
        <div className={cn("relative flex items-center", className)}>
            {!isOpen ? (
                <button
                    onClick={() => setIsOpen(true)}
                    aria-label="Search music"
                    className="rounded p-1.5 text-[var(--color-player-text-muted)] transition-colors hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]"
                >
                    <Search className="h-3.5 w-3.5" />
                </button>
            ) : (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />

                    <div className="relative z-40 flex flex-col">
                        {/* Input row */}
                        <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-[var(--color-player-accent)] bg-[var(--color-player-bg)] px-2.5 py-1">
                            <SourceTabs
                                active={source}
                                onChange={s => {
                                    setSource(s);
                                }}
                                size="xs"
                            />
                            <div className="mx-1 h-4 w-px bg-[var(--color-player-border)]" />
                            {source !== "spotify" ? (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder={placeholder}
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-44 bg-transparent text-xs text-[var(--color-player-text)] placeholder-[var(--color-player-text-muted)] outline-none sm:w-56"
                                />
                            ) : (
                                <span className="w-44 text-xs text-[var(--color-player-text-muted)] sm:w-56">
                                    Paste a Spotify URL below ↓
                                </span>
                            )}
                            {isLoading && (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-player-text-muted)]" />
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded p-0.5 text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]"
                                aria-label="Close search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        {/* Streaming "Open in App" button */}
                        {(() => {
                            const q = query.trim();
                            if (!q.startsWith("http")) return null;
                            const platform = detectPlatformFromUrl(q);
                            if (!platform) return null;
                            return (
                                <div className="absolute left-0 top-full mt-1 w-80 rounded-lg border border-[var(--color-player-border)] bg-[var(--color-player-surface)] p-2 shadow-2xl sm:w-96">
                                    <button
                                        onClick={() => void launchInApp(platform, q)}
                                        className="flex w-full items-center gap-2 rounded-lg bg-player-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                                    >
                                        <span>{platform.icon}</span>
                                        Open in {platform.name}
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Results / Spotify panel */}
                        {(source === "spotify" || query.trim().length > 1) && (
                            <div className="absolute left-0 top-full max-h-80 w-80 overflow-y-auto rounded-b-lg border border-[var(--color-player-border)] bg-[var(--color-player-surface)] shadow-2xl sm:w-96">
                                {source === "spotify" ? (
                                    <div className="p-3">
                                        <SpotifyPanel
                                            query={query}
                                            setQuery={setQuery}
                                            inputRef={inputRef}
                                            onAdd={onAdd}
                                            onClose={() => setIsOpen(false)}
                                            size="sm"
                                        />
                                    </div>
                                ) : (
                                    <ResultList
                                        results={results}
                                        query={query}
                                        isLoading={isLoading}
                                        activeIndex={activeIndex}
                                        onSelect={handleSelect}
                                        source={source}
                                        emptyHint={emptyHint}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
