/**
 * youtubeSearch — search YouTube videos via the Piped public API.
 *
 * Uses the same PIPED_INSTANCES fallback pattern as pipedPlayer.ts.
 * No API key required. Returns [] on total failure (never throws).
 */

export interface YouTubeSearchResult {
    videoId: string;
    title: string;
    channelName: string;
    thumbnail: string;
    duration: number; // seconds
}

interface PipedSearchItem {
    type?: string;
    url?: string;
    title?: string;
    uploaderName?: string;
    thumbnail?: string;
    duration?: number;
}

interface PipedSearchResponse {
    items?: PipedSearchItem[];
    error?: string;
}

const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://piped-api.garudalinux.org",
    "https://api.piped.projectsegfault.net",
    "https://watchapi.whatever.social",
];

const TIMEOUT_MS = 6_000;

/**
 * Search YouTube for videos matching `query`.
 * Tries each Piped instance in order; first success wins.
 * Returns [] if every instance fails.
 */
export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
    for (const base of PIPED_INSTANCES) {
        try {
            const url = `${base}/search?q=${encodeURIComponent(query)}&filter=videos`;
            const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
            if (!res.ok) continue;
            const data = (await res.json()) as PipedSearchResponse;
            if (data.error || !Array.isArray(data.items)) continue;

            const results: YouTubeSearchResult[] = [];
            for (const item of data.items) {
                if (item.type !== "stream" && item.type !== "video") continue;
                const videoId = item.url?.split("v=")[1]?.split("&")[0] ?? "";
                if (!videoId) continue;
                results.push({
                    videoId,
                    title: item.title ?? "Unknown",
                    channelName: item.uploaderName ?? "",
                    thumbnail: item.thumbnail ?? "",
                    duration: item.duration ?? 0,
                });
            }
            if (results.length > 0) return results;
        } catch {
            // Network error / timeout — try next instance.
        }
    }
    return [];
}
