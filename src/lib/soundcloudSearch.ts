/**
 * soundcloudSearch — search SoundCloud tracks via the unofficial v2 API.
 *
 * SoundCloud does not expose a public key-free search API. The client_id used
 * here is extracted from SoundCloud's own web app and is widely used by
 * open-source projects. It may rotate; the function returns [] on any failure
 * so the caller degrades gracefully.
 *
 * For URL-based entry (paste a SoundCloud link), parseMediaUrl() handles it
 * directly — no API call needed.
 */

export interface SoundCloudSearchResult {
    id: number;
    trackUrl: string;
    title: string;
    userName: string;
    thumbnail: string;
    duration: number; // seconds
    embedUrl: string;
}

interface SCTrack {
    id?: number;
    title?: string;
    permalink_url?: string;
    user?: { username?: string };
    artwork_url?: string;
    duration?: number; // ms
}

interface SCSearchResponse {
    collection?: SCTrack[];
}

// Known public client_id extracted from SoundCloud's web app.
// This is the same id used by many open-source SC clients.
const SC_CLIENT_ID = "iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX";
const SC_API = "https://api-v2.soundcloud.com";
const TIMEOUT_MS = 6_000;

function buildEmbedUrl(trackUrl: string): string {
    return (
        "https://w.soundcloud.com/player/?url=" +
        encodeURIComponent(trackUrl) +
        "&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false" +
        "&show_user=true&show_reposts=false&show_teaser=false"
    );
}

/**
 * Search SoundCloud for tracks matching `query`.
 * Returns [] on any failure — never throws.
 */
export async function searchSoundCloud(query: string): Promise<SoundCloudSearchResult[]> {
    try {
        const url =
            `${SC_API}/search/tracks` +
            `?q=${encodeURIComponent(query)}` +
            `&limit=12&offset=0&client_id=${SC_CLIENT_ID}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) return [];

        const data = (await res.json()) as SCSearchResponse;
        if (!Array.isArray(data.collection)) return [];

        const results: SoundCloudSearchResult[] = [];
        for (const track of data.collection) {
            if (!track.id || !track.permalink_url) continue;
            const thumbnail = track.artwork_url ? track.artwork_url.replace("-large", "-t300x300") : "";
            results.push({
                id: track.id,
                trackUrl: track.permalink_url,
                title: track.title ?? "Unknown",
                userName: track.user?.username ?? "",
                thumbnail,
                duration: Math.round((track.duration ?? 0) / 1000),
                embedUrl: buildEmbedUrl(track.permalink_url),
            });
        }
        return results;
    } catch {
        return [];
    }
}
