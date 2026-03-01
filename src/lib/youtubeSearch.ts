/**
 * youtubeSearch — resilient YouTube search with environment-aware transport.
 *
 * Strategy order:
 *  1) Tauri backend (yt-dlp)                    → desktop / laptop
 *  2) Configured backend URL or same-origin API → hosted non-static
 *  3) Direct public APIs (Invidious/Piped)      → static-only best effort
 *
 * Returns [] on total failure (never throws).
 */
import { isTauri, ytSearchVideos } from "@/lib/tauriPlayer";

export interface YouTubeSearchResult {
    videoId: string;
    title: string;
    channelName: string;
    thumbnail: string;
    duration: number; // seconds
}

interface InvidiousThumbnail {
    quality?: string;
    url?: string;
    width?: number;
    height?: number;
}

interface InvidiousVideo {
    type?: string;
    videoId?: string;
    title?: string;
    author?: string;
    lengthSeconds?: number;
    videoThumbnails?: InvidiousThumbnail[];
}

interface PipedSearchVideo {
    id?: string;
    url?: string;
    title?: string;
    uploaderName?: string;
    duration?: number;
    thumbnail?: string;
}

const SEARCH_LIMIT = 12;
const INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://invidious.perennialte.ch",
    "https://yt.artemislena.eu",
    "https://yewtu.be",
    "https://invidious.privacyredirect.com",
];
const PIPED_SEARCH_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://piped-api.garudalinux.org",
    "https://api.piped.projectsegfault.net",
    "https://watchapi.whatever.social",
];

const TIMEOUT_MS = 6_000;
const LOCAL_BACKEND_PATH = "/api/youtube/search";

function bestThumbnail(thumbs: InvidiousThumbnail[] | undefined): string {
    if (!thumbs?.length) return "";
    // Prefer "high" quality, fall back to first available
    const high = thumbs.find(t => t.quality === "high" || t.quality === "medium");
    const chosen = high ?? thumbs[0];
    return chosen?.url ?? "";
}

function normalizeThumbnail(url: string): string {
    if (!url) return "";
    if (url.startsWith("//")) return `https:${url}`;
    return url;
}

function mapInvidiousVideos(data: InvidiousVideo[]): YouTubeSearchResult[] {
    const results: YouTubeSearchResult[] = [];
    for (const item of data) {
        if (!item.videoId) continue;
        results.push({
            videoId: item.videoId,
            title: item.title ?? "Unknown",
            channelName: item.author ?? "",
            thumbnail: normalizeThumbnail(bestThumbnail(item.videoThumbnails)),
            duration: item.lengthSeconds ?? 0,
        });
    }
    return results;
}

function toVideoId(v: PipedSearchVideo): string {
    if (v.id?.trim()) return v.id.trim();
    if (!v.url) return "";
    const m = v.url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ?? v.url.match(/\/watch\/([A-Za-z0-9_-]{6,})/);
    return m?.[1] ?? "";
}

function mapPipedVideos(data: PipedSearchVideo[]): YouTubeSearchResult[] {
    const results: YouTubeSearchResult[] = [];
    for (const item of data) {
        const videoId = toVideoId(item);
        if (!videoId) continue;
        results.push({
            videoId,
            title: item.title ?? "Unknown",
            channelName: item.uploaderName ?? "",
            thumbnail: normalizeThumbnail(item.thumbnail ?? ""),
            duration: item.duration ?? 0,
        });
    }
    return results;
}

async function fetchJson(url: string): Promise<unknown | null> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return null;
        return (await res.json()) as unknown;
    } catch {
        return null;
    }
}

async function searchViaTauriBackend(query: string): Promise<YouTubeSearchResult[]> {
    if (!isTauri()) return [];
    try {
        const data = await ytSearchVideos(query, SEARCH_LIMIT);
        return data
            .filter(item => !!item.video_id)
            .map(item => ({
                videoId: item.video_id,
                title: item.title || "Unknown",
                channelName: item.author || "",
                thumbnail: normalizeThumbnail(item.thumbnail || ""),
                duration: item.duration || 0,
            }));
    } catch {
        return [];
    }
}

function backendUrls(query: string): string[] {
    const params = new URLSearchParams({
        q: query,
        limit: String(SEARCH_LIMIT),
        type: "video",
        fields: "videoId,title,author,lengthSeconds,videoThumbnails",
    });
    const urls: string[] = [];

    const fromEnv = (import.meta.env.VITE_YOUTUBE_SEARCH_BACKEND ?? "").trim();
    if (fromEnv) {
        const sep = fromEnv.includes("?") ? "&" : "?";
        urls.push(`${fromEnv}${sep}${params.toString()}`);
    }
    if (typeof window !== "undefined" && window.location.protocol !== "file:") {
        urls.push(`${LOCAL_BACKEND_PATH}?${params.toString()}`);
    }
    return urls;
}

async function searchViaHttpBackend(query: string): Promise<YouTubeSearchResult[]> {
    for (const url of backendUrls(query)) {
        const json = await fetchJson(url);
        if (!Array.isArray(json)) continue;

        const maybeInvidious = mapInvidiousVideos(json as InvidiousVideo[]);
        if (maybeInvidious.length > 0) return maybeInvidious;

        const maybePiped = mapPipedVideos(json as PipedSearchVideo[]);
        if (maybePiped.length > 0) return maybePiped;
    }
    return [];
}

async function searchDirectInvidious(query: string): Promise<YouTubeSearchResult[]> {
    for (const base of INVIDIOUS_INSTANCES) {
        const url =
            `${base}/api/v1/search` +
            `?q=${encodeURIComponent(query)}&type=video` +
            `&fields=videoId,title,author,lengthSeconds,videoThumbnails`;
        const json = await fetchJson(url);
        if (!Array.isArray(json)) continue;
        const mapped = mapInvidiousVideos(json as InvidiousVideo[]);
        if (mapped.length > 0) return mapped;
    }
    return [];
}

async function searchDirectPiped(query: string): Promise<YouTubeSearchResult[]> {
    for (const base of PIPED_SEARCH_INSTANCES) {
        const url = `${base}/search?q=${encodeURIComponent(query)}&filter=videos`;
        const json = await fetchJson(url);
        if (!Array.isArray(json)) continue;
        const mapped = mapPipedVideos(json as PipedSearchVideo[]);
        if (mapped.length > 0) return mapped;
    }
    return [];
}

/**
 * Search YouTube for videos matching `query`.
 * Uses backend-first transport, then browser-side public API fallback.
 * Returns [] if every instance fails.
 */
export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const tauriResults = await searchViaTauriBackend(q);
    if (tauriResults.length > 0) return tauriResults;

    const backendResults = await searchViaHttpBackend(q);
    if (backendResults.length > 0) return backendResults;

    const invidiousResults = await searchDirectInvidious(q);
    if (invidiousResults.length > 0) return invidiousResults;

    const pipedResults = await searchDirectPiped(q);
    if (pipedResults.length > 0) return pipedResults;

    return [];
}
