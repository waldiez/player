/** Source types produced by URL-based parsing (excludes device sources). */
export type UrlSourceType = "file" | "youtube" | "spotify" | "url";

export interface ParsedMediaUrl {
    sourceType: UrlSourceType;
    name: string;
    /** Original URL (stored as MediaFile.path) */
    path: string;
    /** iframe src for YouTube / Spotify embeds */
    embedUrl?: string;
    /** Extracted YouTube video ID */
    youtubeId?: string;
    /** YouTube playlist ID (when URL contains list=) */
    playlistId?: string;
}

/**
 * Parse a pasted URL and return source metadata, or null if the URL is
 * not an HTTP/HTTPS URL (e.g. RTSP — callers should handle that separately).
 *
 * Only returns url-based source types (youtube / spotify / url). Device sources
 * (camera / microphone / stream) are handled separately via AddDeviceDialog.
 */
export function parseMediaUrl(input: string): ParsedMediaUrl | null {
    const url = input.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

    // ── YouTube ────────────────────────────────────────────────────────────
    const ytId = extractYouTubeId(url);
    const ytListId = extractYouTubePlaylistId(url);
    if (ytId || ytListId) {
        const embedBase = ytId
            ? `https://www.youtube.com/embed/${ytId}?enablejsapi=1&rel=0&modestbranding=1`
            : `https://www.youtube.com/embed/videoseries?enablejsapi=1&rel=0&modestbranding=1`;
        const embedUrl = ytListId ? `${embedBase}&list=${ytListId}&listType=playlist` : embedBase;
        const name =
            ytId && ytListId
                ? `YouTube Playlist — ${ytListId.slice(0, 10)}`
                : ytListId
                  ? `YouTube Playlist — ${ytListId.slice(0, 10)}`
                  : `YouTube — ${ytId}`;
        return {
            sourceType: "youtube",
            name,
            path: url,
            embedUrl,
            youtubeId: ytId ?? undefined,
            playlistId: ytListId ?? undefined,
        };
    }

    // ── Spotify ────────────────────────────────────────────────────────────
    const spotifyEmbed = buildSpotifyEmbedUrl(url);
    if (spotifyEmbed) {
        try {
            const u = new URL(url);
            const parts = u.pathname.split("/").filter(Boolean);
            const kind = parts.at(-2) ?? "track";
            const id = parts.at(-1)?.split("?")[0] ?? "";
            return {
                sourceType: "spotify",
                name: `Spotify ${kind} — ${id.slice(0, 10)}`,
                path: url,
                embedUrl: spotifyEmbed,
            };
        } catch {
            /* ignore */
        }
    }

    // ── Generic HTTP(S) stream / direct audio file ─────────────────────────
    const name = url.split("/").filter(Boolean).pop()?.split("?")[0] ?? "Stream";
    return {
        sourceType: "url",
        name: decodeURIComponent(name),
        path: url,
    };
}

/** Extract a YouTube video ID from any recognised YouTube URL format. */
export function extractYouTubeId(url: string): string | null {
    try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com")) {
            const v = u.searchParams.get("v");
            if (v) return v;
            const seg = u.pathname.split("/").filter(Boolean);
            if (seg[0] === "embed" || seg[0] === "shorts" || seg[0] === "live") return seg[1] ?? null;
        }
        if (u.hostname === "youtu.be") {
            return u.pathname.split("/").filter(Boolean)[0] ?? null;
        }
    } catch {
        /* ignore */
    }
    return null;
}

/**
 * Extract a YouTube playlist ID (list=) from a URL.
 * Works for both watch?v=X&list=PL... and /playlist?list=PL... forms.
 */
export function extractYouTubePlaylistId(url: string): string | null {
    try {
        const u = new URL(url);
        if (!u.hostname.includes("youtube.com") && u.hostname !== "youtu.be") return null;
        return u.searchParams.get("list");
    } catch {
        return null;
    }
}

function buildSpotifyEmbedUrl(url: string): string | null {
    try {
        const u = new URL(url);
        if (!u.hostname.includes("spotify.com")) return null;
        const parts = u.pathname.split("/").filter(Boolean);
        const kind = parts[0];
        const id = parts[1];
        const supported = ["track", "album", "playlist", "artist", "episode", "show"];
        if (id && supported.includes(kind)) {
            return `https://open.spotify.com/embed/${kind}/${id}?utm_source=generator`;
        }
    } catch {
        /* ignore */
    }
    return null;
}

/** Returns true for rtsp:// / rtsps:// URLs that browsers cannot play. */
export function isRtspUrl(input: string): boolean {
    const s = input.trim().toLowerCase();
    return s.startsWith("rtsp://") || s.startsWith("rtsps://");
}
