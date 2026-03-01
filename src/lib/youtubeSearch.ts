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
import { isTauri, isTauriPackaged, ytSearchVideos } from "@/lib/tauriPlayer";
import { readUiSettings } from "@/lib/uiSettings";

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

interface YouTubeDataSearchItem {
    id?: { videoId?: string };
    snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
            medium?: { url?: string };
            high?: { url?: string };
            default?: { url?: string };
        };
    };
}

interface YouTubeDataVideosItem {
    id?: string;
    contentDetails?: { duration?: string };
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
const YT_DATA_API_BASE = "https://www.googleapis.com/youtube/v3";
let lastYouTubeSearchError = "";

export function getLastYouTubeSearchError(): string {
    return lastYouTubeSearchError;
}

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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        if (controller) {
            timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        }
        const res = await fetch(url, { signal: controller?.signal });
        if (!res.ok) return null;
        return (await res.json()) as unknown;
    } catch {
        return null;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

function parseIso8601Duration(input: string | undefined): number {
    if (!input) return 0;
    const m = input.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return 0;
    const h = Number(m[1] ?? 0);
    const min = Number(m[2] ?? 0);
    const s = Number(m[3] ?? 0);
    return h * 3600 + min * 60 + s;
}

function getYouTubeApiKey(): string {
    if (typeof window === "undefined") return "";
    const qp = new URLSearchParams(window.location.search);
    const fromQuery = (qp.get("yt_api_key") ?? qp.get("yt_api") ?? "").trim();
    if (fromQuery) {
        try {
            localStorage.setItem("waldiez:youtube_api_key", fromQuery);
        } catch {
            // ignore storage errors
        }
        return fromQuery;
    }
    const fromUiSettings = readUiSettings().youtubeApiKey.trim();
    if (fromUiSettings) return fromUiSettings;
    try {
        const legacy = (localStorage.getItem("waldiez:youtube_api_key") ?? "").trim();
        if (legacy) return legacy;
    } catch {
        // ignore storage errors
    }
    return (import.meta.env.VITE_YOUTUBE_API_KEY ?? "").trim();
}

async function searchViaYouTubeDataApi(query: string): Promise<YouTubeSearchResult[]> {
    const key = getYouTubeApiKey();
    if (!key) {
        lastYouTubeSearchError = "YouTube API key missing. Pass YT_API_KEY (Flutter) or VITE_YOUTUBE_API_KEY (web).";
        return [];
    }

    const searchUrl =
        `${YT_DATA_API_BASE}/search?part=snippet&type=video&maxResults=${SEARCH_LIMIT}` +
        `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;
    const searchRes = await fetch(searchUrl).catch(() => null);
    if (!searchRes) {
        lastYouTubeSearchError = "YouTube API request failed (network).";
        return [];
    }
    if (!searchRes.ok) {
        let details = "";
        try {
            const errJson = (await searchRes.json()) as { error?: { message?: string } };
            details = errJson.error?.message ?? "";
        } catch {
            // ignore parse errors
        }
        lastYouTubeSearchError = `YouTube API rejected request (${searchRes.status})${details ? `: ${details}` : ""}`;
        return [];
    }
    const searchJson = (await searchRes.json()) as unknown;
    const items = (searchJson as { items?: YouTubeDataSearchItem[] } | null)?.items;
    if (!Array.isArray(items) || items.length === 0) {
        lastYouTubeSearchError = "YouTube API returned no items.";
        return [];
    }

    const ids = items.map(item => item.id?.videoId ?? "").filter(Boolean);
    let durations = new Map<string, number>();
    if (ids.length > 0) {
        const detailsUrl =
            `${YT_DATA_API_BASE}/videos?part=contentDetails&id=${encodeURIComponent(ids.join(","))}` +
            `&key=${encodeURIComponent(key)}`;
        const detailsJson = await fetchJson(detailsUrl);
        const detailItems = (detailsJson as { items?: YouTubeDataVideosItem[] } | null)?.items;
        if (Array.isArray(detailItems)) {
            durations = new Map(
                detailItems
                    .filter(item => !!item.id)
                    .map(item => [item.id as string, parseIso8601Duration(item.contentDetails?.duration)]),
            );
        }
    }

    const results: YouTubeSearchResult[] = [];
    for (const item of items) {
        const videoId = item.id?.videoId ?? "";
        if (!videoId) continue;
        const thumbs = item.snippet?.thumbnails;
        const thumbnail = normalizeThumbnail(thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? "");
        results.push({
            videoId,
            title: item.snippet?.title ?? "Unknown",
            channelName: item.snippet?.channelTitle ?? "",
            thumbnail,
            duration: durations.get(videoId) ?? 0,
        });
    }
    lastYouTubeSearchError = "";
    return results;
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
    lastYouTubeSearchError = "";
    const q = query.trim();
    if (q.length < 2) return [];

    const packagedDesktop = isTauriPackaged();

    if (packagedDesktop) {
        // Packaged desktop: web-first strategy, backend optional.
        const ytDataResults = await searchViaYouTubeDataApi(q);
        if (ytDataResults.length > 0) return ytDataResults;

        const backendResults = await searchViaHttpBackend(q);
        if (backendResults.length > 0) return backendResults;

        const invidiousResults = await searchDirectInvidious(q);
        if (invidiousResults.length > 0) return invidiousResults;

        const pipedResults = await searchDirectPiped(q);
        if (pipedResults.length > 0) return pipedResults;

        const tauriResults = await searchViaTauriBackend(q);
        if (tauriResults.length > 0) return tauriResults;
        return [];
    }

    const tauriResults = await searchViaTauriBackend(q);
    if (tauriResults.length > 0) return tauriResults;

    const ytDataResults = await searchViaYouTubeDataApi(q);
    if (ytDataResults.length > 0) return ytDataResults;

    const backendResults = await searchViaHttpBackend(q);
    if (backendResults.length > 0) return backendResults;

    const invidiousResults = await searchDirectInvidious(q);
    if (invidiousResults.length > 0) return invidiousResults;

    const pipedResults = await searchDirectPiped(q);
    if (pipedResults.length > 0) return pipedResults;

    return [];
}
