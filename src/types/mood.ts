/**
 * Mood modes — immersive audio-visual experiences
 * Ported from WIderia Player (kideria/web/player.js)
 */

export type MoodMode = "journey" | "dock" | "storm" | "fest" | "rock" | "pop" | "disco";

export const MOOD_MODES: MoodMode[] = ["journey", "dock", "storm", "fest", "rock", "pop", "disco"];

export const MOOD_CHAR_COLORS = {
    lute: "#C8941A",
    violin: "#9B4FCB",
    shaman: "#4A8F3C",
    band: "#E8C84A",
} as const;

// ── EQ + FX ────────────────────────────────────────────────────────────────

export interface AudioChainConfig {
    eq: {
        bass: number; // dB, -12 to +12
        mid: number;
        treble: number;
    };
    fx: {
        reverb: boolean;
        echo: boolean;
        fuzz: boolean;
        vinyl: boolean;
    };
}

export type EQPresetName = "flat" | "lute" | "violin" | "shaman" | "punk" | "vinyl";

export const EQ_PRESETS: Record<EQPresetName, { label: string } & AudioChainConfig> = {
    flat: {
        label: "Flat",
        eq: { bass: 0, mid: 0, treble: 0 },
        fx: { reverb: false, echo: false, fuzz: false, vinyl: false },
    },
    lute: {
        label: "Lute",
        eq: { bass: 3, mid: 1, treble: -1 },
        fx: { reverb: true, echo: false, fuzz: false, vinyl: false },
    },
    violin: {
        label: "Violin",
        eq: { bass: -2, mid: 2, treble: 4 },
        fx: { reverb: true, echo: false, fuzz: false, vinyl: false },
    },
    shaman: {
        label: "Shaman",
        eq: { bass: 6, mid: 0, treble: -2 },
        fx: { reverb: false, echo: true, fuzz: false, vinyl: false },
    },
    punk: {
        label: "Punk",
        eq: { bass: 4, mid: -2, treble: 2 },
        fx: { reverb: false, echo: false, fuzz: true, vinyl: false },
    },
    vinyl: {
        label: "Vinyl",
        eq: { bass: 1, mid: 3, treble: -4 },
        fx: { reverb: true, echo: false, fuzz: false, vinyl: true },
    },
};

export const DEFAULT_AUDIO_CHAIN: AudioChainConfig = {
    eq: { bass: 0, mid: 0, treble: 0 },
    fx: { reverb: false, echo: false, fuzz: false, vinyl: false },
};

// ── Per-mood metadata ──────────────────────────────────────────────────────

export interface MoodMeta {
    label: string;
    description: string;
    accent: string;
    bg: string;
    defaultEQ: EQPresetName;
}

export const MOOD_META: Record<MoodMode, MoodMeta> = {
    journey: {
        label: "Journey",
        description: "4-character radial spectrum — all chapters together",
        accent: "#C8941A",
        bg: "#0e0806",
        defaultEQ: "lute",
    },
    dock: {
        label: "Dock",
        description: "Spinning vinyl under a warm harbour light",
        accent: "#D4A04A",
        bg: "#0b0905",
        defaultEQ: "vinyl",
    },
    storm: {
        label: "Storm",
        description: "Lightning frequency bars in the electric dark",
        accent: "#1ABCD4",
        bg: "#050912",
        defaultEQ: "shaman",
    },
    fest: {
        label: "Fest",
        description: "Concert stage — spotlights, crowd, circular spectrum",
        accent: "#A060D8",
        bg: "#08040f",
        defaultEQ: "flat",
    },
    rock: {
        label: "Rock",
        description: "Distorted bars, rising embers, raw electric energy",
        accent: "#E83A14",
        bg: "#0f0203",
        defaultEQ: "punk",
    },
    pop: {
        label: "Pop",
        description: "Neon bubbles, rainbow bars, sparkles",
        accent: "#F72585",
        bg: "#080115",
        defaultEQ: "violin",
    },
    disco: {
        label: "Disco",
        description: "Spinning disco ball, mirrored bars, light projections",
        accent: "#FFD700",
        bg: "#02020f",
        defaultEQ: "vinyl",
    },
};
