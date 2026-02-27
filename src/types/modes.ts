/**
 * Player Modes - Different playback experiences
 * Each mode configures UI, effects, controls, and behavior
 */

export type PlayerMode =
    | "standard"
    | "storyteller"
    | "audiobook"
    | "cinema"
    | "presentation"
    | "learning"
    // Mood / audio-visual experience modes (canvas visualizer, Web Audio chain)
    | "journey"
    | "dock"
    | "storm"
    | "fest"
    | "rock"
    | "pop"
    | "disco";

export interface PlayerModeConfig {
    id: PlayerMode;
    name: string;
    description: string;
    icon: string;
    theme: ModeTheme;
    controls: ModeControls;
    effects: ModeEffects;
    behavior: ModeBehavior;
    audio: ModeAudio;
}

export interface ModeTheme {
    // Color palette
    background: string;
    surface: string;
    accent: string;
    text: string;
    textMuted: string;

    // Visual style
    borderRadius: "none" | "sm" | "md" | "lg" | "full";
    shadows: "none" | "soft" | "medium" | "dramatic";

    // Overlay effects
    vignette: number; // 0-1
    grain: number; // 0-1
    warmth: number; // -1 to 1 (cool to warm)
    saturation: number; // 0-2

    // Special elements
    customOverlay?: string; // CSS/SVG overlay
    customCursor?: string; // Custom cursor style
}

export interface ModeControls {
    // Visibility
    showProgressBar: boolean;
    showTimeDisplay: boolean;
    showPlaybackSpeed: boolean;
    showVolumeControl: boolean;
    showFullscreen: boolean;
    showChapters: boolean;
    showBookmarks: boolean;

    // Navigation style
    navigationStyle: "continuous" | "page-based" | "chapter-based";
    showPageControls: boolean;
    showPageIndicator: boolean;
    allowManualPageTurn: boolean;

    // Control behavior
    autoHideControls: boolean;
    autoHideDelay: number; // ms
    controlsPosition: "bottom" | "overlay" | "side" | "minimal";
    controlsOpacity: number; // 0-1

    // Touch/gesture
    swipeToNavigate: boolean;
    tapToPlayPause: boolean;
    doubleTapToSeek: boolean;

    // Special controls
    sleepTimer: boolean;
    abLoop: boolean;
    frameStep: boolean;
    annotations: boolean;
}

export interface ModeEffects {
    // Default filter stack
    defaultFilters: {
        brightness: number;
        contrast: number;
        saturation: number;
        hue: number;
        blur: number;
        sepia: number;
        grayscale: number;
    };

    // Transitions
    transitionStyle: "cut" | "fade" | "dissolve" | "page-turn" | "slide";
    transitionDuration: number; // ms

    // Overlays
    letterbox: boolean;
    letterboxRatio: number; // e.g., 2.35 for cinematic
    frameOverlay?: string; // e.g., "vintage-frame", "book-page"

    // Animation
    kenBurnsEnabled: boolean;
    kenBurnsIntensity: number; // 0-1
    parallaxEnabled: boolean;
}

export interface ModeBehavior {
    // Playback
    autoPlay: boolean;
    loop: boolean;
    defaultSpeed: number;
    pauseBetweenChapters: boolean;
    chapterPauseDuration: number; // ms

    // Progress
    rememberPosition: boolean;
    showProgressOnHover: boolean;

    // Chapters/Pages
    autoAdvance: boolean;
    advanceDelay: number; // ms for manual modes
    requireInteraction: boolean; // must click/tap to advance

    // Sleep/Timer
    sleepTimerOptions: number[]; // minutes
    fadeOutOnSleep: boolean;

    // Sync
    syncTextHighlight: boolean;
    syncAnimations: boolean;
}

export interface ModeAudio {
    // Ambient sounds
    ambientSound?: AmbientSound;
    ambientVolume: number; // 0-1

    // Music behavior
    backgroundMusicDuck: boolean; // lower music during narration
    duckAmount: number; // 0-1, how much to reduce
    duckFadeDuration: number; // ms

    // Voice
    voiceBoost: boolean;
    voiceBoostAmount: number; // dB

    // Spatial
    spatialAudio: boolean;

    // Transitions
    transitionSound?: string; // sound effect for page turns, etc.
    transitionSoundVolume: number;
}

export interface AmbientSound {
    id: string;
    name: string;
    url: string;
    loop: boolean;
    fadeIn: number; // ms
    fadeOut: number; // ms
}

// Predefined ambient sounds
export const AMBIENT_SOUNDS: AmbientSound[] = [
    {
        id: "fireplace",
        name: "Cozy Fireplace",
        url: "ambient/fireplace.mp3",
        loop: true,
        fadeIn: 2000,
        fadeOut: 3000,
    },
    {
        id: "rain",
        name: "Gentle Rain",
        url: "ambient/rain.mp3",
        loop: true,
        fadeIn: 1500,
        fadeOut: 2000,
    },
    {
        id: "forest",
        name: "Forest Ambience",
        url: "ambient/forest.mp3",
        loop: true,
        fadeIn: 2000,
        fadeOut: 2500,
    },
    {
        id: "ocean",
        name: "Ocean Waves",
        url: "ambient/ocean.mp3",
        loop: true,
        fadeIn: 2000,
        fadeOut: 3000,
    },
    {
        id: "library",
        name: "Quiet Library",
        url: "ambient/library.mp3",
        loop: true,
        fadeIn: 1000,
        fadeOut: 1500,
    },
    {
        id: "cafe",
        name: "Coffee Shop",
        url: "ambient/cafe.mp3",
        loop: true,
        fadeIn: 1500,
        fadeOut: 2000,
    },
];

// ── Mood mode base ─────────────────────────────────────────────────────────
const moodBase: Omit<PlayerModeConfig, "id" | "name" | "description" | "icon" | "theme"> = {
    controls: {
        showProgressBar: true,
        showTimeDisplay: true,
        showPlaybackSpeed: false,
        showVolumeControl: true,
        showFullscreen: false,
        showChapters: false,
        showBookmarks: false,
        navigationStyle: "continuous",
        showPageControls: false,
        showPageIndicator: false,
        allowManualPageTurn: false,
        autoHideControls: true,
        autoHideDelay: 4000,
        controlsPosition: "bottom",
        controlsOpacity: 0.85,
        swipeToNavigate: false,
        tapToPlayPause: true,
        doubleTapToSeek: false,
        sleepTimer: true,
        abLoop: false,
        frameStep: false,
        annotations: false,
    },
    effects: {
        defaultFilters: {
            brightness: 1,
            contrast: 1,
            saturation: 1,
            hue: 0,
            blur: 0,
            sepia: 0,
            grayscale: 0,
        },
        transitionStyle: "fade",
        transitionDuration: 600,
        letterbox: false,
        letterboxRatio: 16 / 9,
        kenBurnsEnabled: false,
        kenBurnsIntensity: 0,
        parallaxEnabled: false,
    },
    behavior: {
        autoPlay: false,
        loop: true,
        defaultSpeed: 1,
        pauseBetweenChapters: false,
        chapterPauseDuration: 0,
        rememberPosition: false,
        showProgressOnHover: false,
        autoAdvance: true,
        advanceDelay: 0,
        requireInteraction: false,
        sleepTimerOptions: [15, 30, 60, 90],
        fadeOutOnSleep: true,
        syncTextHighlight: false,
        syncAnimations: false,
    },
    audio: {
        ambientVolume: 0,
        backgroundMusicDuck: false,
        duckAmount: 0,
        duckFadeDuration: 0,
        voiceBoost: false,
        voiceBoostAmount: 0,
        spatialAudio: false,
        transitionSoundVolume: 0,
    },
};

// Predefined mode configurations
export const MODE_CONFIGS: Record<PlayerMode, PlayerModeConfig> = {
    standard: {
        id: "standard",
        name: "Standard",
        description: "Default video player experience",
        icon: "play-circle",
        theme: {
            background: "#0a0a0f",
            surface: "#12121a",
            accent: "#6366f1",
            text: "#e2e8f0",
            textMuted: "#94a3b8",
            borderRadius: "md",
            shadows: "medium",
            vignette: 0,
            grain: 0,
            warmth: 0,
            saturation: 1,
        },
        controls: {
            showProgressBar: true,
            showTimeDisplay: true,
            showPlaybackSpeed: true,
            showVolumeControl: true,
            showFullscreen: true,
            showChapters: true,
            showBookmarks: true,
            navigationStyle: "continuous",
            showPageControls: false,
            showPageIndicator: false,
            allowManualPageTurn: false,
            autoHideControls: true,
            autoHideDelay: 3000,
            controlsPosition: "bottom",
            controlsOpacity: 1,
            swipeToNavigate: false,
            tapToPlayPause: true,
            doubleTapToSeek: true,
            sleepTimer: false,
            abLoop: false,
            frameStep: false,
            annotations: false,
        },
        effects: {
            defaultFilters: {
                brightness: 1,
                contrast: 1,
                saturation: 1,
                hue: 0,
                blur: 0,
                sepia: 0,
                grayscale: 0,
            },
            transitionStyle: "cut",
            transitionDuration: 0,
            letterbox: false,
            letterboxRatio: 16 / 9,
            kenBurnsEnabled: false,
            kenBurnsIntensity: 0,
            parallaxEnabled: false,
        },
        behavior: {
            autoPlay: false,
            loop: false,
            defaultSpeed: 1,
            pauseBetweenChapters: false,
            chapterPauseDuration: 0,
            rememberPosition: true,
            showProgressOnHover: true,
            autoAdvance: true,
            advanceDelay: 0,
            requireInteraction: false,
            sleepTimerOptions: [15, 30, 45, 60, 90],
            fadeOutOnSleep: true,
            syncTextHighlight: false,
            syncAnimations: false,
        },
        audio: {
            ambientVolume: 0,
            backgroundMusicDuck: false,
            duckAmount: 0.3,
            duckFadeDuration: 500,
            voiceBoost: false,
            voiceBoostAmount: 3,
            spatialAudio: false,
            transitionSoundVolume: 0,
        },
    },

    storyteller: {
        id: "storyteller",
        name: "Storyteller",
        description: "Cozy fireside storytelling experience",
        icon: "flame",
        theme: {
            background: "#1a1410",
            surface: "#2a2018",
            accent: "#d97706",
            text: "#fef3c7",
            textMuted: "#a8a29e",
            borderRadius: "lg",
            shadows: "soft",
            vignette: 0.4,
            grain: 0.15,
            warmth: 0.3,
            saturation: 0.85,
        },
        controls: {
            showProgressBar: true,
            showTimeDisplay: true,
            showPlaybackSpeed: false,
            showVolumeControl: true,
            showFullscreen: true,
            showChapters: true,
            showBookmarks: true,
            navigationStyle: "chapter-based",
            showPageControls: true,
            showPageIndicator: true,
            allowManualPageTurn: true,
            autoHideControls: true,
            autoHideDelay: 5000,
            controlsPosition: "bottom",
            controlsOpacity: 0.9,
            swipeToNavigate: true,
            tapToPlayPause: true,
            doubleTapToSeek: false,
            sleepTimer: true,
            abLoop: false,
            frameStep: false,
            annotations: false,
        },
        effects: {
            defaultFilters: {
                brightness: 0.95,
                contrast: 1.05,
                saturation: 0.9,
                hue: 0,
                blur: 0,
                sepia: 0.15,
                grayscale: 0,
            },
            transitionStyle: "fade",
            transitionDuration: 1500,
            letterbox: false,
            letterboxRatio: 16 / 9,
            kenBurnsEnabled: true,
            kenBurnsIntensity: 0.3,
            parallaxEnabled: false,
        },
        behavior: {
            autoPlay: true,
            loop: false,
            defaultSpeed: 0.95,
            pauseBetweenChapters: true,
            chapterPauseDuration: 2000,
            rememberPosition: true,
            showProgressOnHover: false,
            autoAdvance: true,
            advanceDelay: 1500,
            requireInteraction: false,
            sleepTimerOptions: [15, 30, 45, 60],
            fadeOutOnSleep: true,
            syncTextHighlight: true,
            syncAnimations: true,
        },
        audio: {
            ambientSound: AMBIENT_SOUNDS.find(s => s.id === "fireplace"),
            ambientVolume: 0.25,
            backgroundMusicDuck: true,
            duckAmount: 0.4,
            duckFadeDuration: 800,
            voiceBoost: true,
            voiceBoostAmount: 2,
            spatialAudio: false,
            transitionSound: "chime-soft",
            transitionSoundVolume: 0.3,
        },
    },

    audiobook: {
        id: "audiobook",
        name: "Audiobook",
        description: "Page-based reading experience with manual controls",
        icon: "book-open",
        theme: {
            background: "#faf6f1",
            surface: "#ffffff",
            accent: "#059669",
            text: "#1f2937",
            textMuted: "#6b7280",
            borderRadius: "sm",
            shadows: "soft",
            vignette: 0,
            grain: 0,
            warmth: 0.1,
            saturation: 1,
        },
        controls: {
            showProgressBar: true,
            showTimeDisplay: true,
            showPlaybackSpeed: true,
            showVolumeControl: true,
            showFullscreen: true,
            showChapters: true,
            showBookmarks: true,
            navigationStyle: "page-based",
            showPageControls: true,
            showPageIndicator: true,
            allowManualPageTurn: true,
            autoHideControls: false,
            autoHideDelay: 0,
            controlsPosition: "bottom",
            controlsOpacity: 1,
            swipeToNavigate: true,
            tapToPlayPause: true,
            doubleTapToSeek: false,
            sleepTimer: true,
            abLoop: true,
            frameStep: false,
            annotations: true,
        },
        effects: {
            defaultFilters: {
                brightness: 1,
                contrast: 1,
                saturation: 1,
                hue: 0,
                blur: 0,
                sepia: 0,
                grayscale: 0,
            },
            transitionStyle: "page-turn",
            transitionDuration: 400,
            letterbox: false,
            letterboxRatio: 16 / 9,
            frameOverlay: "book-page",
            kenBurnsEnabled: false,
            kenBurnsIntensity: 0,
            parallaxEnabled: false,
        },
        behavior: {
            autoPlay: false,
            loop: false,
            defaultSpeed: 1,
            pauseBetweenChapters: true,
            chapterPauseDuration: 0,
            rememberPosition: true,
            showProgressOnHover: true,
            autoAdvance: false,
            advanceDelay: 0,
            requireInteraction: true,
            sleepTimerOptions: [15, 30, 45, 60, 90, 120],
            fadeOutOnSleep: true,
            syncTextHighlight: true,
            syncAnimations: false,
        },
        audio: {
            ambientVolume: 0,
            backgroundMusicDuck: true,
            duckAmount: 0.5,
            duckFadeDuration: 300,
            voiceBoost: true,
            voiceBoostAmount: 3,
            spatialAudio: false,
            transitionSound: "page-turn",
            transitionSoundVolume: 0.2,
        },
    },

    cinema: {
        id: "cinema",
        name: "Cinema",
        description: "Immersive movie theater experience",
        icon: "film",
        theme: {
            background: "#000000",
            surface: "#0a0a0a",
            accent: "#ef4444",
            text: "#ffffff",
            textMuted: "#737373",
            borderRadius: "none",
            shadows: "none",
            vignette: 0.2,
            grain: 0.05,
            warmth: 0,
            saturation: 1.05,
        },
        controls: {
            showProgressBar: true,
            showTimeDisplay: true,
            showPlaybackSpeed: false,
            showVolumeControl: true,
            showFullscreen: true,
            showChapters: true,
            showBookmarks: false,
            navigationStyle: "continuous",
            showPageControls: false,
            showPageIndicator: false,
            allowManualPageTurn: false,
            autoHideControls: true,
            autoHideDelay: 2000,
            controlsPosition: "overlay",
            controlsOpacity: 0.8,
            swipeToNavigate: false,
            tapToPlayPause: true,
            doubleTapToSeek: true,
            sleepTimer: false,
            abLoop: false,
            frameStep: false,
            annotations: false,
        },
        effects: {
            defaultFilters: {
                brightness: 1,
                contrast: 1.1,
                saturation: 1.05,
                hue: 0,
                blur: 0,
                sepia: 0,
                grayscale: 0,
            },
            transitionStyle: "fade",
            transitionDuration: 500,
            letterbox: true,
            letterboxRatio: 2.35,
            kenBurnsEnabled: false,
            kenBurnsIntensity: 0,
            parallaxEnabled: false,
        },
        behavior: {
            autoPlay: true,
            loop: false,
            defaultSpeed: 1,
            pauseBetweenChapters: false,
            chapterPauseDuration: 0,
            rememberPosition: true,
            showProgressOnHover: true,
            autoAdvance: true,
            advanceDelay: 0,
            requireInteraction: false,
            sleepTimerOptions: [],
            fadeOutOnSleep: false,
            syncTextHighlight: false,
            syncAnimations: false,
        },
        audio: {
            ambientVolume: 0,
            backgroundMusicDuck: false,
            duckAmount: 0,
            duckFadeDuration: 0,
            voiceBoost: false,
            voiceBoostAmount: 0,
            spatialAudio: true,
            transitionSoundVolume: 0,
        },
    },

    presentation: {
        id: "presentation",
        name: "Presentation",
        description: "Slide-based presentation mode",
        icon: "presentation",
        theme: {
            background: "#1e293b",
            surface: "#334155",
            accent: "#3b82f6",
            text: "#f1f5f9",
            textMuted: "#94a3b8",
            borderRadius: "md",
            shadows: "medium",
            vignette: 0,
            grain: 0,
            warmth: 0,
            saturation: 1,
        },
        controls: {
            showProgressBar: true,
            showTimeDisplay: true,
            showPlaybackSpeed: false,
            showVolumeControl: true,
            showFullscreen: true,
            showChapters: true,
            showBookmarks: false,
            navigationStyle: "page-based",
            showPageControls: true,
            showPageIndicator: true,
            allowManualPageTurn: true,
            autoHideControls: false,
            autoHideDelay: 0,
            controlsPosition: "side",
            controlsOpacity: 1,
            swipeToNavigate: true,
            tapToPlayPause: false,
            doubleTapToSeek: false,
            sleepTimer: false,
            abLoop: false,
            frameStep: false,
            annotations: true,
        },
        effects: {
            defaultFilters: {
                brightness: 1,
                contrast: 1,
                saturation: 1,
                hue: 0,
                blur: 0,
                sepia: 0,
                grayscale: 0,
            },
            transitionStyle: "slide",
            transitionDuration: 300,
            letterbox: false,
            letterboxRatio: 16 / 9,
            kenBurnsEnabled: false,
            kenBurnsIntensity: 0,
            parallaxEnabled: false,
        },
        behavior: {
            autoPlay: false,
            loop: false,
            defaultSpeed: 1,
            pauseBetweenChapters: true,
            chapterPauseDuration: 0,
            rememberPosition: false,
            showProgressOnHover: true,
            autoAdvance: false,
            advanceDelay: 0,
            requireInteraction: true,
            sleepTimerOptions: [],
            fadeOutOnSleep: false,
            syncTextHighlight: false,
            syncAnimations: true,
        },
        audio: {
            ambientVolume: 0,
            backgroundMusicDuck: false,
            duckAmount: 0,
            duckFadeDuration: 0,
            voiceBoost: false,
            voiceBoostAmount: 0,
            spatialAudio: false,
            transitionSoundVolume: 0,
        },
    },

    learning: {
        id: "learning",
        name: "Learning",
        description: "Educational mode with practice tools",
        icon: "graduation-cap",
        theme: {
            background: "#0f172a",
            surface: "#1e293b",
            accent: "#8b5cf6",
            text: "#e2e8f0",
            textMuted: "#94a3b8",
            borderRadius: "md",
            shadows: "medium",
            vignette: 0,
            grain: 0,
            warmth: 0,
            saturation: 1,
        },
        controls: {
            showProgressBar: true,
            showTimeDisplay: true,
            showPlaybackSpeed: true,
            showVolumeControl: true,
            showFullscreen: true,
            showChapters: true,
            showBookmarks: true,
            navigationStyle: "continuous",
            showPageControls: false,
            showPageIndicator: false,
            allowManualPageTurn: false,
            autoHideControls: false,
            autoHideDelay: 0,
            controlsPosition: "bottom",
            controlsOpacity: 1,
            swipeToNavigate: false,
            tapToPlayPause: true,
            doubleTapToSeek: true,
            sleepTimer: false,
            abLoop: true,
            frameStep: true,
            annotations: true,
        },
        effects: {
            defaultFilters: {
                brightness: 1,
                contrast: 1,
                saturation: 1,
                hue: 0,
                blur: 0,
                sepia: 0,
                grayscale: 0,
            },
            transitionStyle: "cut",
            transitionDuration: 0,
            letterbox: false,
            letterboxRatio: 16 / 9,
            kenBurnsEnabled: false,
            kenBurnsIntensity: 0,
            parallaxEnabled: false,
        },
        behavior: {
            autoPlay: false,
            loop: false,
            defaultSpeed: 1,
            pauseBetweenChapters: true,
            chapterPauseDuration: 1000,
            rememberPosition: true,
            showProgressOnHover: true,
            autoAdvance: false,
            advanceDelay: 0,
            requireInteraction: false,
            sleepTimerOptions: [30, 60, 90],
            fadeOutOnSleep: true,
            syncTextHighlight: true,
            syncAnimations: true,
        },
        audio: {
            ambientVolume: 0,
            backgroundMusicDuck: true,
            duckAmount: 0.5,
            duckFadeDuration: 300,
            voiceBoost: true,
            voiceBoostAmount: 2,
            spatialAudio: false,
            transitionSoundVolume: 0,
        },
    },

    journey: {
        ...moodBase,
        id: "journey",
        name: "Journey",
        icon: "orbit",
        description: "All characters together — 4-quadrant radial spectrum",
        theme: {
            background: "#0e0806",
            surface: "#1a1008",
            accent: "#C8941A",
            text: "#fef3c7",
            textMuted: "#a8996e",
            borderRadius: "lg",
            shadows: "dramatic",
            vignette: 0.3,
            grain: 0.1,
            warmth: 0.2,
            saturation: 1,
        },
    },
    dock: {
        ...moodBase,
        id: "dock",
        name: "Dock",
        icon: "disc-3",
        description: "Spinning vinyl under a warm harbour light",
        theme: {
            background: "#0b0905",
            surface: "#1a1408",
            accent: "#D4A04A",
            text: "#fef3c7",
            textMuted: "#a8906a",
            borderRadius: "lg",
            shadows: "soft",
            vignette: 0.25,
            grain: 0.12,
            warmth: 0.3,
            saturation: 0.9,
        },
    },
    storm: {
        ...moodBase,
        id: "storm",
        name: "Storm",
        icon: "zap",
        description: "Lightning frequency bars in the electric dark",
        theme: {
            background: "#050912",
            surface: "#0d1424",
            accent: "#1ABCD4",
            text: "#e0f2ff",
            textMuted: "#6aadcc",
            borderRadius: "none",
            shadows: "dramatic",
            vignette: 0.15,
            grain: 0.05,
            warmth: -0.2,
            saturation: 1.1,
        },
    },
    fest: {
        ...moodBase,
        id: "fest",
        name: "Fest",
        icon: "sparkles",
        description: "Concert stage — spotlights, crowd, circular spectrum",
        theme: {
            background: "#08040f",
            surface: "#180a2a",
            accent: "#A060D8",
            text: "#f0e8ff",
            textMuted: "#9070b8",
            borderRadius: "md",
            shadows: "dramatic",
            vignette: 0.2,
            grain: 0.08,
            warmth: 0,
            saturation: 1.05,
        },
    },
    rock: {
        ...moodBase,
        id: "rock",
        name: "Rock",
        icon: "guitar",
        description: "Distorted bars, rising embers, raw electric energy",
        theme: {
            background: "#0f0203",
            surface: "#1f0505",
            accent: "#E83A14",
            text: "#fff0ec",
            textMuted: "#c07060",
            borderRadius: "none",
            shadows: "dramatic",
            vignette: 0.2,
            grain: 0.12,
            warmth: 0.1,
            saturation: 1.1,
        },
    },
    pop: {
        ...moodBase,
        id: "pop",
        name: "Pop",
        icon: "mic-2",
        description: "Neon bubbles, rainbow bars, sparkles",
        theme: {
            background: "#080115",
            surface: "#18053a",
            accent: "#F72585",
            text: "#ffe4f7",
            textMuted: "#c060a0",
            borderRadius: "lg",
            shadows: "dramatic",
            vignette: 0.15,
            grain: 0.04,
            warmth: -0.05,
            saturation: 1.15,
        },
    },
    disco: {
        ...moodBase,
        id: "disco",
        name: "Disco",
        icon: "disc-2",
        description: "Spinning disco ball, mirrored bars, light projections",
        theme: {
            background: "#02020f",
            surface: "#0b0820",
            accent: "#FFD700",
            text: "#fff8e0",
            textMuted: "#c8a830",
            borderRadius: "md",
            shadows: "dramatic",
            vignette: 0.18,
            grain: 0.06,
            warmth: 0.15,
            saturation: 1.05,
        },
    },
};

// Helper to get mode config
export function getModeConfig(mode: PlayerMode): PlayerModeConfig {
    return MODE_CONFIGS[mode];
}

// Helper to merge custom overrides with mode defaults
export function createCustomMode(
    baseMode: PlayerMode,
    overrides: Partial<PlayerModeConfig>,
): PlayerModeConfig {
    const base = MODE_CONFIGS[baseMode];
    return {
        ...base,
        ...overrides,
        theme: { ...base.theme, ...overrides.theme },
        controls: { ...base.controls, ...overrides.controls },
        effects: { ...base.effects, ...overrides.effects },
        behavior: { ...base.behavior, ...overrides.behavior },
        audio: { ...base.audio, ...overrides.audio },
    };
}
