/**
 * streamingLaunchers — deep-link / web launcher for streaming platforms.
 * In Tauri, uses shell.open(); in browser, falls back to window.open().
 */
import { isTauri } from "@/lib/tauriPlayer";

export interface StreamingPlatform {
    id: string;
    name: string;
    icon: string; // emoji
    deepLinkScheme: string;
    webUrl: string;
    searchUrl: (query: string) => string;
    contentUrl: (id: string) => string;
}

export const STREAMING_PLATFORMS: StreamingPlatform[] = [
    {
        id: "netflix",
        name: "Netflix",
        icon: "🎬",
        deepLinkScheme: "nflx://",
        webUrl: "https://www.netflix.com",
        searchUrl: q => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
        contentUrl: id => `https://www.netflix.com/title/${id}`,
    },
    {
        id: "hbo",
        name: "Max",
        icon: "📺",
        deepLinkScheme: "hbomax://",
        webUrl: "https://www.max.com",
        searchUrl: q => `https://www.max.com/search?q=${encodeURIComponent(q)}`,
        contentUrl: id => `https://www.max.com/movies/${id}`,
    },
    {
        id: "disney",
        name: "Disney+",
        icon: "✨",
        deepLinkScheme: "disneyplus://",
        webUrl: "https://www.disneyplus.com",
        searchUrl: q => `https://www.disneyplus.com/search/${encodeURIComponent(q)}`,
        contentUrl: id => `https://www.disneyplus.com/movies/${id}`,
    },
    {
        id: "apple-tv",
        name: "Apple TV",
        icon: "🍎",
        deepLinkScheme: "com.apple.tv://",
        webUrl: "https://tv.apple.com",
        searchUrl: q => `https://tv.apple.com/search?term=${encodeURIComponent(q)}`,
        contentUrl: id => `https://tv.apple.com/movie/${id}`,
    },
    {
        id: "prime",
        name: "Prime",
        icon: "📦",
        deepLinkScheme: "aiv://",
        webUrl: "https://www.primevideo.com",
        searchUrl: q => `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${encodeURIComponent(q)}`,
        contentUrl: id => `https://www.primevideo.com/detail/${id}`,
    },
    {
        id: "spotify",
        name: "Spotify",
        icon: "🎵",
        deepLinkScheme: "spotify://",
        webUrl: "https://open.spotify.com",
        searchUrl: q => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
        contentUrl: id => `https://open.spotify.com/track/${id}`,
    },
];

/** Map of host → platform id for URL detection. */
const HOST_TO_PLATFORM: Record<string, string> = {
    "netflix.com": "netflix",
    "www.netflix.com": "netflix",
    "max.com": "hbo",
    "www.max.com": "hbo",
    "hbomax.com": "hbo",
    "www.hbomax.com": "hbo",
    "disneyplus.com": "disney",
    "www.disneyplus.com": "disney",
    "tv.apple.com": "apple-tv",
    "primevideo.com": "prime",
    "www.primevideo.com": "prime",
    "open.spotify.com": "spotify",
};

export function detectPlatformFromUrl(url: string): StreamingPlatform | null {
    try {
        const { hostname } = new URL(url);
        const id = HOST_TO_PLATFORM[hostname];
        return id ? (STREAMING_PLATFORMS.find(p => p.id === id) ?? null) : null;
    } catch {
        return null;
    }
}

export async function launchInApp(platform: StreamingPlatform, url?: string): Promise<void> {
    const target = url ?? platform.webUrl;

    if (isTauri()) {
        // Use shell.open via the existing plugin
        try {
            const { open } = await import("@tauri-apps/plugin-shell");
            await open(target);
            return;
        } catch {
            // fall through to window.open
        }
    }

    window.open(target, "_blank", "noopener,noreferrer");
}
