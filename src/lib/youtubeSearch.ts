/**
 * youtubeSearch — resilient YouTube search with environment-aware transport.
 *
 * Strategy order:
 *  1) Tauri backend (yt-dlp)                    → desktop / laptop
 *  2) Configured backend URL or same-origin API → hosted non-static
 *  3) YouTube Data API (user/env key)           → all runtimes
 *  4) No-key public API + Invidious + Piped     → static-only best effort
 *  5) Local cached results                       → offline / blocked fallback
 *
 * Returns [] on total failure (never throws).
 */
import { getRuntimeContext } from "@/lib/runtime";
import { ytSearchVideos } from "@/lib/tauriPlayer";
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
}

interface InvidiousVideo {
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

interface NoKeySearchItem {
    id?: { videoId?: string } | string;
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
const NO_KEY_SEARCH_BASES = ["https://yt.lemnoslife.com/noKey"];

const TIMEOUT_MS = 6_000;
const LOCAL_BACKEND_PATH = "/api/youtube/search";
const YT_DATA_API_BASE = "https://www.googleapis.com/youtube/v3";
const SEARCH_CACHE_PREFIX = "waldiez:yt-search-cache:v1:";
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

let lastYouTubeSearchError = "";

export function getLastYouTubeSearchError(): string {
    return lastYouTubeSearchError;
}

function bestThumbnail(thumbs: InvidiousThumbnail[] | undefined): string {
    if (!thumbs?.length) return "";
    const high = thumbs.find(t => t.quality === "high" || t.quality === "medium");
    return high?.url ?? thumbs[0]?.url ?? "";
}

function normalizeThumbnail(url: string): string {
    if (!url) return "";
    if (url.startsWith("//")) return `https:${url}`;
    return url;
}

function mapInvidiousVideos(data: InvidiousVideo[]): YouTubeSearchResult[] {
    return data
        .filter(item => !!item.videoId)
        .map(item => ({
            videoId: item.videoId as string,
            title: item.title ?? "Unknown",
            channelName: item.author ?? "",
            thumbnail: normalizeThumbnail(bestThumbnail(item.videoThumbnails)),
            duration: item.lengthSeconds ?? 0,
        }));
}

function toVideoId(v: PipedSearchVideo): string {
    if (v.id?.trim()) return v.id.trim();
    if (!v.url) return "";
    const m = v.url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ?? v.url.match(/\/watch\/([A-Za-z0-9_-]{6,})/);
    return m?.[1] ?? "";
}

function mapPipedVideos(data: PipedSearchVideo[]): YouTubeSearchResult[] {
    const out: YouTubeSearchResult[] = [];
    for (const item of data) {
        const videoId = toVideoId(item);
        if (!videoId) continue;
        out.push({
            videoId,
            title: item.title ?? "Unknown",
            channelName: item.uploaderName ?? "",
            thumbnail: normalizeThumbnail(item.thumbnail ?? ""),
            duration: item.duration ?? 0,
        });
    }
    return out;
}

function cacheKey(query: string): string {
    return `${SEARCH_CACHE_PREFIX}${query.trim().toLowerCase()}`;
}

function readCachedResults(query: string): YouTubeSearchResult[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(cacheKey(query));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as { ts?: number; results?: YouTubeSearchResult[] };
        if (!parsed?.ts || !Array.isArray(parsed.results)) return [];
        if (Date.now() - parsed.ts > SEARCH_CACHE_TTL_MS) return [];
        return parsed.results.filter(r => !!r.videoId);
    } catch {
        return [];
    }
}

function writeCachedResults(query: string, results: YouTubeSearchResult[]): void {
    if (typeof window === "undefined" || results.length === 0) return;
    try {
        localStorage.setItem(cacheKey(query), JSON.stringify({ ts: Date.now(), results }));
    } catch {
        // localStorage unavailable — ignore
    }
}

function withCache(query: string, results: YouTubeSearchResult[]): YouTubeSearchResult[] {
    if (results.length > 0) {
        writeCachedResults(query, results);
        return results;
    }
    const cached = readCachedResults(query);
    if (cached.length > 0) {
        const suffix = "Showing cached results from a previous successful search.";
        lastYouTubeSearchError = lastYouTubeSearchError ? `${lastYouTubeSearchError} ${suffix}` : suffix;
        return cached;
    }
    return [];
}

async function fetchJson(url: string): Promise<unknown | null> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        if (controller) timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
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

    const searchJson = (await searchRes.json()) as { items?: YouTubeDataSearchItem[] };
    const items = searchJson.items;
    if (!Array.isArray(items) || items.length === 0) {
        lastYouTubeSearchError = "YouTube API returned no items.";
        return [];
    }

    const ids = items.map(item => item.id?.videoId ?? "").filter(Boolean);
    const durations = new Map<string, number>();
    if (ids.length > 0) {
        const detailsUrl =
            `${YT_DATA_API_BASE}/videos?part=contentDetails&id=${encodeURIComponent(ids.join(","))}` +
            `&key=${encodeURIComponent(key)}`;
        const detailsJson = await fetchJson(detailsUrl);
        const detailItems = (detailsJson as { items?: YouTubeDataVideosItem[] } | null)?.items;
        if (Array.isArray(detailItems)) {
            for (const item of detailItems) {
                if (!item.id) continue;
                durations.set(item.id, parseIso8601Duration(item.contentDetails?.duration));
            }
        }
    }

    const results: YouTubeSearchResult[] = [];
    for (const item of items) {
        const videoId = item.id?.videoId ?? "";
        if (!videoId) continue;
        const t = item.snippet?.thumbnails;
        results.push({
            videoId,
            title: item.snippet?.title ?? "Unknown",
            channelName: item.snippet?.channelTitle ?? "",
            thumbnail: normalizeThumbnail(t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? ""),
            duration: durations.get(videoId) ?? 0,
        });
    }
    if (results.length > 0) lastYouTubeSearchError = "";
    return results;
}

async function searchViaNoKeyApi(query: string): Promise<YouTubeSearchResult[]> {
    for (const base of NO_KEY_SEARCH_BASES) {
        const url =
            `${base}/search?part=snippet&type=video&maxResults=${SEARCH_LIMIT}` +
            `&q=${encodeURIComponent(query)}`;
        const json = await fetchJson(url);
        const items = (json as { items?: NoKeySearchItem[] } | null)?.items;
        if (!Array.isArray(items) || items.length === 0) continue;

        const results: YouTubeSearchResult[] = [];
        for (const item of items) {
            const idObj = item.id;
            const videoId = typeof idObj === "string" ? idObj : (idObj?.videoId ?? "");
            if (!videoId) continue;
            const t = item.snippet?.thumbnails;
            results.push({
                videoId,
                title: item.snippet?.title ?? "Unknown",
                channelName: item.snippet?.channelTitle ?? "",
                thumbnail: normalizeThumbnail(t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? ""),
                duration: 0,
            });
        }
        if (results.length > 0) return results;
    }
    return [];
}

async function searchViaTauriBackend(query: string): Promise<YouTubeSearchResult[]> {
    if (!getRuntimeContext().isTauri) return [];
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

    const runtime = getRuntimeContext();
    const packagedDesktop = runtime.isPackagedDesktop;
    const backendConfigured = (import.meta.env.VITE_YOUTUBE_SEARCH_BACKEND ?? "").trim().length > 0;

    if (packagedDesktop) {
        const ytData = await searchViaYouTubeDataApi(q);
        if (ytData.length > 0) return withCache(q, ytData);

        const backend = await searchViaHttpBackend(q);
        if (backend.length > 0) return withCache(q, backend);

        if (backendConfigured) {
            const cached = withCache(q, []);
            if (cached.length > 0) return cached;
            if (!lastYouTubeSearchError) {
                lastYouTubeSearchError =
                    "Search backend is configured but returned no results/unreachable. Check backend health or add an API key.";
            }
            return [];
        }

        const noKey = await searchViaNoKeyApi(q);
        if (noKey.length > 0) return withCache(q, noKey);

        const invidious = await searchDirectInvidious(q);
        if (invidious.length > 0) return withCache(q, invidious);

        const piped = await searchDirectPiped(q);
        if (piped.length > 0) return withCache(q, piped);

        const tauri = await searchViaTauriBackend(q);
        if (tauri.length > 0) return withCache(q, tauri);

        const cached = withCache(q, []);
        if (cached.length > 0) return cached;
        if (!lastYouTubeSearchError) {
            lastYouTubeSearchError =
                "Search unavailable. Tried backend + no-key public providers (Invidious/Piped), but they appear blocked/unreachable. Add an API key, configure backend search, or paste a YouTube URL.";
        }
        return [];
    }

    const tauri = await searchViaTauriBackend(q);
    if (tauri.length > 0) return withCache(q, tauri);

    const ytData = await searchViaYouTubeDataApi(q);
    if (ytData.length > 0) return withCache(q, ytData);

    const backend = await searchViaHttpBackend(q);
    if (backend.length > 0) return withCache(q, backend);

    if (backendConfigured) {
        const cached = withCache(q, []);
        if (cached.length > 0) return cached;
        if (!lastYouTubeSearchError) {
            lastYouTubeSearchError =
                "Search backend is configured but returned no results/unreachable. Check backend health or add an API key.";
        }
        return [];
    }

    const noKey = await searchViaNoKeyApi(q);
    if (noKey.length > 0) return withCache(q, noKey);

    const invidious = await searchDirectInvidious(q);
    if (invidious.length > 0) return withCache(q, invidious);

    const piped = await searchDirectPiped(q);
    if (piped.length > 0) return withCache(q, piped);

    const cached = withCache(q, []);
    if (cached.length > 0) return cached;
    if (!lastYouTubeSearchError) {
        lastYouTubeSearchError =
            "Search unavailable. Tried backend + no-key public providers (Invidious/Piped), but they appear blocked/unreachable. Add an API key, configure backend search, or paste a YouTube URL.";
    }
    return [];
}
