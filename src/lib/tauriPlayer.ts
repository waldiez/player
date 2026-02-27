/**
 * tauriPlayer — thin wrappers around the Tauri yt-dlp and mpv commands.
 *
 * All functions are no-ops (or throw) when called outside Tauri.
 * The caller is responsible for checking `isTauri()` first.
 *
 * yt-dlp backend
 * ──────────────
 *   ytGetAudioUrl(videoId) → direct CDN URL suitable for <audio src>
 *   Advantage: audio runs through the Web Audio chain (EQ / FX / visualiser).
 *
 * mpv backend
 * ───────────
 *   mpvLoad(url)  — plays YouTube, local files, HLS, RTSP, anything mpv knows.
 *   State is pushed to the Tauri window as "mpv-event" events; use
 *   listenMpvEvents() to subscribe.
 *   Caveat: audio goes through the system mixer, not the Web Audio chain.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// ── Environment detection ──────────────────────────────────────────────────

/** Returns true when running inside a Tauri desktop shell. */
export function isTauri(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// ── Event types ────────────────────────────────────────────────────────────

export type MpvEventPayload =
    | { type: "Time"; value: number }
    | { type: "Duration"; value: number }
    | { type: "Paused"; value: boolean }
    | { type: "Volume"; value: number }
    | { type: "Ended" };

// ── yt-dlp ─────────────────────────────────────────────────────────────────

/** Returns true if `yt-dlp` is installed on the system. */
export async function ytCheck(): Promise<boolean> {
    return invoke<boolean>("yt_check");
}

/**
 * Returns a direct CDN URL for the given YouTube video ID.
 * The URL is time-limited (~6 h) and can be set as `<audio src>`.
 * Throws if yt-dlp is not installed or the video cannot be fetched.
 */
export async function ytGetAudioUrl(videoId: string): Promise<string> {
    return invoke<string>("yt_get_audio_url", { videoId });
}

/** Fetches title and duration for a YouTube video (no download). */
export async function ytGetVideoInfo(videoId: string): Promise<{ title: string; duration: number }> {
    return invoke("yt_get_video_info", { videoId });
}

// ── mpv ────────────────────────────────────────────────────────────────────

/** Returns true if `mpv` is installed on the system. */
export async function mpvCheck(): Promise<boolean> {
    return invoke<boolean>("mpv_check");
}

/**
 * Load a URL or path into mpv and start playing.
 * Auto-starts the mpv daemon on first call.
 * Accepts YouTube URLs, local files, HLS, RTSP, RTMP, etc.
 */
export async function mpvLoad(url: string): Promise<void> {
    return invoke("mpv_load", { url });
}

export async function mpvPause(): Promise<void> {
    return invoke("mpv_pause");
}

export async function mpvResume(): Promise<void> {
    return invoke("mpv_resume");
}

/** Seek to an absolute position in seconds. */
export async function mpvSeek(seconds: number): Promise<void> {
    return invoke("mpv_seek", { seconds });
}

/** Set volume. `volume` is 0.0–1.0. */
export async function mpvSetVolume(volume: number): Promise<void> {
    return invoke("mpv_set_volume", { volume });
}

/** Set playback speed (e.g. 1.5 for 1.5×). */
export async function mpvSetSpeed(rate: number): Promise<void> {
    return invoke("mpv_set_speed", { rate });
}

export async function mpvStop(): Promise<void> {
    return invoke("mpv_stop");
}

export async function mpvQuit(): Promise<void> {
    return invoke("mpv_quit");
}

/**
 * Subscribe to mpv state events.
 * Returns an unsubscribe function — call it on component unmount.
 *
 * Events: Time (current seconds), Duration, Paused, Volume (0–1), Ended.
 */
export async function listenMpvEvents(callback: (event: MpvEventPayload) => void): Promise<() => void> {
    return listen<MpvEventPayload>("mpv-event", e => callback(e.payload));
}
