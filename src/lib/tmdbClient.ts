/**
 * tmdbClient — TMDB metadata enrichment for local video files.
 * Session-caches results keyed by query string.
 */
import type { MediaFile } from "@/types/player";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

export interface TmdbResult {
    tmdbId: number;
    title: string;
    overview: string;
    posterUrl: string | null;
    releaseDate: string;
    genres: string[];
    rating: number;
    mediaType: "movie" | "tv";
}

function cacheKey(query: string): string {
    return `tmdb:v1:${query.toLowerCase().trim()}`;
}

function loadCached(query: string): TmdbResult | null {
    try {
        const raw = sessionStorage.getItem(cacheKey(query));
        return raw ? (JSON.parse(raw) as TmdbResult) : null;
    } catch {
        return null;
    }
}

function saveCached(query: string, result: TmdbResult): void {
    try {
        sessionStorage.setItem(cacheKey(query), JSON.stringify(result));
    } catch {
        // ignore
    }
}

export async function searchTmdb(query: string, apiKey: string): Promise<TmdbResult | null> {
    if (!apiKey || !query.trim()) return null;
    const cached = loadCached(query);
    if (cached) return cached;

    try {
        const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&include_adult=false`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = (await res.json()) as {
            results?: {
                id: number;
                title?: string;
                name?: string;
                overview?: string;
                poster_path?: string;
                release_date?: string;
                first_air_date?: string;
                genre_ids?: number[];
                vote_average?: number;
                media_type?: string;
            }[];
        };
        const item = data.results?.find(r => r.media_type === "movie" || r.media_type === "tv");
        if (!item) return null;

        const result: TmdbResult = {
            tmdbId: item.id,
            title: item.title ?? item.name ?? "",
            overview: item.overview ?? "",
            posterUrl: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
            releaseDate: item.release_date ?? item.first_air_date ?? "",
            genres: [],
            rating: item.vote_average ?? 0,
            mediaType: item.media_type === "tv" ? "tv" : "movie",
        };
        saveCached(query, result);
        return result;
    } catch {
        return null;
    }
}

/** Strip file extension, year, and quality tags to derive a clean search query. */
function deriveSearchQuery(filename: string): string {
    return filename
        .replace(/\.[a-zA-Z0-9]{2,4}$/, "") // remove extension
        .replace(/\b(19|20)\d{2}\b/g, "") // remove year
        .replace(/\b(1080p|720p|4k|uhd|bluray|hdtv|webrip|bdrip|dvdrip)\b/gi, "")
        .replace(/[._-]+/g, " ")
        .trim();
}

export async function enrichMediaFile(file: MediaFile, apiKey: string): Promise<Partial<MediaFile>> {
    const query = deriveSearchQuery(file.name);
    if (!query) return {};
    const result = await searchTmdb(query, apiKey);
    if (!result) return {};
    return {
        thumbnailUrl: result.posterUrl ?? file.thumbnailUrl,
        tmdbId: result.tmdbId,
        tmdbOverview: result.overview,
        tmdbRating: result.rating,
    };
}
