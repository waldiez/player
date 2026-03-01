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
}

const DEFAULTS: UiSettings = {
    screensaverEnabled: false,
    screensaverTimeoutMinutes: 10,
    screensaverStyle: "animated",
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
