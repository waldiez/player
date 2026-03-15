/**
 * uiSettings — localStorage r/w for UI preferences.
 * Currently covers screensaver; designed to be extended later.
 */

const UI_SETTINGS_KEY = "wideria-ui";

export type ScreensaverStyle = "minimal" | "animated" | "artwork";

export interface UiSettings {
    screensaverEnabled: boolean;
    screensaverTimeoutMinutes: 5 | 10 | 15 | 30;
    screensaverStyle: ScreensaverStyle;
    /** When true, pause playback while the tab/window is backgrounded. */
    pausePlaybackWhenHidden: boolean;
    /** Optional user-provided YouTube Data API key used for client-side search fallback. */
    youtubeApiKey: string;
    /** Optional TMDB API key for enriching local video files with movie/TV metadata. */
    tmdbApiKey: string;
    /** When true, suggest a mood based on current weather conditions. */
    weatherMoodEnabled: boolean;
    /** When true, auto-switch to the weather-suggested mood on app startup. */
    autoMoodOnStartup: boolean;
    /** When true, show a diagnostic toast when YouTube native audio resolution fails. Off by default. */
    showYtFallbackDiagnostics: boolean;
}

const DEFAULTS: UiSettings = {
    screensaverEnabled: false,
    screensaverTimeoutMinutes: 10,
    screensaverStyle: "animated",
    pausePlaybackWhenHidden: false,
    youtubeApiKey: "",
    tmdbApiKey: "",
    weatherMoodEnabled: false,
    autoMoodOnStartup: false,
    showYtFallbackDiagnostics: false,
};

export function readUiSettings(): UiSettings {
    try {
        const raw = localStorage.getItem(UI_SETTINGS_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw) as Partial<UiSettings>;
        return { ...DEFAULTS, ...parsed };
    } catch {
        return { ...DEFAULTS };
    }
}

export function writeUiSettings(patch: Partial<UiSettings>): UiSettings {
    const next = { ...readUiSettings(), ...patch };
    try {
        localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(next));
    } catch {
        // localStorage unavailable — ignore
    }
    return next;
}
