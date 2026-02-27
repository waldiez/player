/**
 * pipedPlayer — extract a direct audio stream URL from YouTube via the
 * Piped public API (https://github.com/TeamPiped/Piped).
 *
 * Why this works in the browser
 * ──────────────────────────────
 * Piped's API returns direct `googlevideo.com` or Piped-proxied stream URLs.
 * Both carry `Access-Control-Allow-Origin: *`, so the browser can:
 *   1. Play them in an <audio> element with crossOrigin="anonymous"
 *   2. Connect that element to the Web Audio API (EQ / FX / visualiser)
 *
 * The returned URL is time-limited (~6 h), same as a yt-dlp extraction.
 * There are no ads because the YouTube player is bypassed entirely.
 *
 * Instances are tried in order; the first one that succeeds wins.
 * Add/remove instances to taste — full list at https://piped.video/instances
 */

interface PipedAudioStream {
    url: string;
    bitrate: number;
    mimeType: string;
    codec: string;
}

interface PipedStreamsResponse {
    audioStreams?: PipedAudioStream[];
    title?: string;
    duration?: number;
    error?: string;
}

// Public Piped instances — ordered by reliability / latency.
// The first responding instance wins; others serve as fallback.
const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://piped-api.garudalinux.org",
    "https://api.piped.projectsegfault.net",
    "https://watchapi.whatever.social",
];

const TIMEOUT_MS = 6_000;

/**
 * Returns the best-audio stream URL for a YouTube video ID, or `null` if
 * every Piped instance fails (in which case the caller should fall back to
 * the YouTube IFrame).
 *
 * Prefers higher-bitrate streams.  m4a and webm/opus are both typically
 * available and play natively in all modern browsers.
 */
export async function getPipedAudioUrl(videoId: string): Promise<string | null> {
    for (const base of PIPED_INSTANCES) {
        try {
            const res = await fetch(`${base}/streams/${videoId}`, {
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!res.ok) continue;
            const data = (await res.json()) as PipedStreamsResponse;
            if (data.error) continue;

            const streams = [...(data.audioStreams ?? [])].sort(
                (a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0),
            );

            const best = streams[0];
            if (best?.url) return best.url;
        } catch {
            // Network error / timeout — try next instance.
        }
    }
    return null;
}

/**
 * Returns `{ title, duration }` for a YouTube video via Piped, or `null`.
 * Useful for resolving "YouTube · ID" placeholder track names.
 */
export async function getPipedVideoInfo(
    videoId: string,
): Promise<{ title: string; duration: number } | null> {
    for (const base of PIPED_INSTANCES) {
        try {
            const res = await fetch(`${base}/streams/${videoId}`, {
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!res.ok) continue;
            const data = (await res.json()) as PipedStreamsResponse;
            if (data.error || !data.title) continue;
            return { title: data.title, duration: data.duration ?? 0 };
        } catch {
            // try next instance
        }
    }
    return null;
}
