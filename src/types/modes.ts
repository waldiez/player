/**
 * Player Modes - Different playback experiences
 * Each mode configures UI, effects, controls, and behavior
 *
 * Mode configuration data → modeConfigs.ts
 * Helper functions         → modeUtils.ts
 */

export type PlayerMode =
    | "standard"
    | "reader"
    | "editor"
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
    | "disco"
    // Two-deck DJ mixer with crossfader
    | "mixer";

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
