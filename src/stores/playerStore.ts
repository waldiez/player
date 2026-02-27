import type {
    Bookmark,
    Chapter,
    MediaFile,
    PlaybackState,
    PlayerMode,
    PlayerModeConfig,
    VideoEffect,
} from "@/types";
import { getModeConfig } from "@/types";

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface PlayerStore {
    // Player mode (storyteller, audiobook, etc.)
    playerMode: PlayerMode;
    playerModeConfig: PlayerModeConfig;
    setPlayerMode: (mode: PlayerMode) => void;

    // Media
    currentMedia: MediaFile | null;
    mediaLibrary: MediaFile[];
    setCurrentMedia: (media: MediaFile | null) => void;
    addToLibrary: (media: MediaFile) => void;
    removeFromLibrary: (id: string) => void;
    /** Atomically replace the entire library (used by useMoodPersistence on mode change). */
    setMediaLibrary: (items: MediaFile[]) => void;
    reorderLibrary: (fromIndex: number, toIndex: number) => void;

    // Playback
    playback: PlaybackState;
    setPlayback: (updates: Partial<PlaybackState>) => void;
    play: () => void;
    pause: () => void;
    togglePlay: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    setPlaybackRate: (rate: number) => void;
    toggleLoop: () => void;
    toggleFullscreen: () => void;

    // Page-based navigation (for audiobook/presentation modes)
    currentPage: number;
    totalPages: number;
    setCurrentPage: (page: number) => void;
    setTotalPages: (total: number) => void;
    nextPage: () => void;
    prevPage: () => void;

    // Chapters & Bookmarks
    chapters: Chapter[];
    bookmarks: Bookmark[];
    addChapter: (chapter: Chapter) => void;
    removeChapter: (id: string) => void;
    addBookmark: (bookmark: Bookmark) => void;
    removeBookmark: (id: string) => void;
    goToChapter: (index: number) => void;

    // Effects
    effects: VideoEffect[];
    addEffect: (effect: VideoEffect) => void;
    updateEffect: (id: string, updates: Partial<VideoEffect>) => void;
    removeEffect: (id: string) => void;
    toggleEffect: (id: string) => void;
    reorderEffects: (fromIndex: number, toIndex: number) => void;
    applyModeEffects: () => void;

    // Sleep Timer
    sleepTimerMinutes: number | null;
    sleepTimerEndTime: number | null;
    setSleepTimer: (minutes: number | null) => void;
    clearSleepTimer: () => void;

    // A-B Loop (for learning mode)
    abLoop: { a: number | null; b: number | null };
    setLoopPointA: () => void;
    setLoopPointB: () => void;
    clearAbLoop: () => void;

    // Repeat mode
    repeatMode: "none" | "one" | "all";
    cycleRepeatMode: () => void;

    // Playlist navigation
    playNextInLibrary: () => void;
    playPrevInLibrary: () => void;

    // UI State
    showEffectsPanel: boolean;
    showChaptersPanel: boolean;
    showAudioVisualizer: boolean;
    showModeSelector: boolean;
    showPlaylistPanel: boolean;
    toggleEffectsPanel: () => void;
    toggleChaptersPanel: () => void;
    toggleAudioVisualizer: () => void;
    toggleModeSelector: () => void;
    togglePlaylistPanel: () => void;
}

const initialPlaybackState: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    isLooping: false,
    isFullscreen: false,
};

export const usePlayerStore = create<PlayerStore>()(
    devtools(
        persist(
            (set, get) => ({
                // Player mode
                playerMode: "standard",
                playerModeConfig: getModeConfig("standard") || {
                    name: "Standard",
                    description: "Default video player experience",
                    theme: {
                        background: "#0a0a0f",
                        surface: "#12121a",
                        accent: "#6366f1",
                        text: "#e2e8f0",
                        textMuted: "#94a3b8",
                        vignette: 0,
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
                        sleepTimer: false,
                        abLoop: false,
                    },
                    behavior: {
                        defaultSpeed: 1,
                        loop: false,
                        sleepTimerOptions: [],
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
                    },
                },
                setPlayerMode: playerMode => {
                    const config = getModeConfig(playerMode);
                    if (!config) {
                        console.error(`Invalid player mode: ${playerMode}`);
                        return;
                    }
                    set({
                        playerMode,
                        playerModeConfig: config,
                        playback: {
                            ...get().playback,
                            playbackRate: config.behavior.defaultSpeed,
                            isLooping: config.behavior.loop,
                        },
                    });
                    get().applyModeEffects();
                },

                // Media
                currentMedia: null,
                mediaLibrary: [],
                setCurrentMedia: media => set({ currentMedia: media }),
                addToLibrary: media =>
                    set(state => ({
                        mediaLibrary: [...state.mediaLibrary, media],
                    })),
                removeFromLibrary: id =>
                    set(state => ({
                        mediaLibrary: state.mediaLibrary.filter(m => m.id !== id),
                    })),
                setMediaLibrary: items => set({ mediaLibrary: items }),
                reorderLibrary: (fromIndex, toIndex) =>
                    set(state => {
                        const lib = [...state.mediaLibrary];
                        const [removed] = lib.splice(fromIndex, 1);
                        if (removed) lib.splice(toIndex, 0, removed);
                        return { mediaLibrary: lib };
                    }),

                // Playback
                playback: initialPlaybackState,
                setPlayback: updates =>
                    set(state => ({
                        playback: { ...state.playback, ...updates },
                    })),
                play: () =>
                    set(state => ({
                        playback: { ...state.playback, isPlaying: true },
                    })),
                pause: () =>
                    set(state => ({
                        playback: { ...state.playback, isPlaying: false },
                    })),
                togglePlay: () =>
                    set(state => ({
                        playback: { ...state.playback, isPlaying: !state.playback.isPlaying },
                    })),
                seek: time =>
                    set(state => ({
                        playback: { ...state.playback, currentTime: time },
                    })),
                setVolume: volume =>
                    set(state => ({
                        playback: { ...state.playback, volume, isMuted: volume === 0 },
                    })),
                toggleMute: () =>
                    set(state => ({
                        playback: { ...state.playback, isMuted: !state.playback.isMuted },
                    })),
                setPlaybackRate: rate =>
                    set(state => ({
                        playback: { ...state.playback, playbackRate: rate },
                    })),
                toggleLoop: () =>
                    set(state => ({
                        playback: { ...state.playback, isLooping: !state.playback.isLooping },
                    })),
                toggleFullscreen: () =>
                    set(state => ({
                        playback: { ...state.playback, isFullscreen: !state.playback.isFullscreen },
                    })),

                // Page-based navigation
                currentPage: 1,
                totalPages: 1,
                setCurrentPage: page => set({ currentPage: Math.max(1, Math.min(page, get().totalPages)) }),
                setTotalPages: total => set({ totalPages: total }),
                nextPage: () => {
                    const { currentPage, totalPages } = get();
                    if (currentPage < totalPages) {
                        set({ currentPage: currentPage + 1 });
                    }
                },
                prevPage: () => {
                    const { currentPage } = get();
                    if (currentPage > 1) {
                        set({ currentPage: currentPage - 1 });
                    }
                },

                // Chapters & Bookmarks
                chapters: [],
                bookmarks: [],
                addChapter: chapter =>
                    set(state => ({
                        chapters: [...state.chapters, chapter],
                    })),
                removeChapter: id =>
                    set(state => ({
                        chapters: state.chapters.filter(c => c.id !== id),
                    })),
                addBookmark: bookmark =>
                    set(state => ({
                        bookmarks: [...state.bookmarks, bookmark],
                    })),
                removeBookmark: id =>
                    set(state => ({
                        bookmarks: state.bookmarks.filter(b => b.id !== id),
                    })),
                goToChapter: index => {
                    const { chapters } = get();
                    if (index >= 0 && index < chapters.length) {
                        const chapter = chapters[index];
                        if (chapter) {
                            get().seek(chapter.startTime);
                        }
                    }
                },

                // Effects
                effects: [],
                addEffect: effect =>
                    set(state => ({
                        effects: [...state.effects, effect],
                    })),
                updateEffect: (id, updates) =>
                    set(state => ({
                        effects: state.effects.map(e => (e.id === id ? { ...e, ...updates } : e)),
                    })),
                removeEffect: id =>
                    set(state => ({
                        effects: state.effects.filter(e => e.id !== id),
                    })),
                toggleEffect: id =>
                    set(state => ({
                        effects: state.effects.map(e => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
                    })),
                reorderEffects: (fromIndex, toIndex) =>
                    set(state => {
                        const effects = [...state.effects];
                        const [removed] = effects.splice(fromIndex, 1);
                        if (removed) {
                            effects.splice(toIndex, 0, removed);
                        }
                        return { effects };
                    }),
                applyModeEffects: () => {
                    const { playerModeConfig } = get();
                    const { defaultFilters } = playerModeConfig.effects;

                    // Clear existing auto-applied effects and add mode defaults
                    const modeEffects: VideoEffect[] = [];

                    if (defaultFilters.brightness !== 1) {
                        modeEffects.push({
                            id: "mode-brightness",
                            type: "brightness",
                            enabled: true,
                            parameters: { value: defaultFilters.brightness },
                        });
                    }
                    if (defaultFilters.contrast !== 1) {
                        modeEffects.push({
                            id: "mode-contrast",
                            type: "contrast",
                            enabled: true,
                            parameters: { value: defaultFilters.contrast },
                        });
                    }
                    if (defaultFilters.saturation !== 1) {
                        modeEffects.push({
                            id: "mode-saturation",
                            type: "saturation",
                            enabled: true,
                            parameters: { value: defaultFilters.saturation },
                        });
                    }
                    if (defaultFilters.sepia > 0) {
                        modeEffects.push({
                            id: "mode-sepia",
                            type: "hue",
                            enabled: true,
                            parameters: { value: defaultFilters.sepia * 30 },
                        });
                    }

                    // Keep user-added effects (those without "mode-" prefix)
                    const userEffects = get().effects.filter(e => !e.id.startsWith("mode-"));
                    set({ effects: [...modeEffects, ...userEffects] });
                },

                // Sleep Timer
                sleepTimerMinutes: null,
                sleepTimerEndTime: null,
                setSleepTimer: minutes => {
                    if (minutes === null) {
                        set({ sleepTimerMinutes: null, sleepTimerEndTime: null });
                    } else {
                        set({
                            sleepTimerMinutes: minutes,
                            sleepTimerEndTime: Date.now() + minutes * 60 * 1000,
                        });
                    }
                },
                clearSleepTimer: () => set({ sleepTimerMinutes: null, sleepTimerEndTime: null }),

                // A-B Loop
                abLoop: { a: null, b: null },
                setLoopPointA: () => {
                    const { playback } = get();
                    set({ abLoop: { ...get().abLoop, a: playback.currentTime } });
                },
                setLoopPointB: () => {
                    const { playback } = get();
                    set({ abLoop: { ...get().abLoop, b: playback.currentTime } });
                },
                clearAbLoop: () => set({ abLoop: { a: null, b: null } }),

                // Repeat mode
                repeatMode: "none",
                cycleRepeatMode: () => {
                    const rm = get().repeatMode;
                    set({ repeatMode: rm === "none" ? "all" : rm === "all" ? "one" : "none" });
                },

                // Playlist navigation
                playNextInLibrary: () => {
                    const { mediaLibrary, currentMedia, repeatMode } = get();
                    if (!mediaLibrary.length) return;
                    const idx = currentMedia ? mediaLibrary.findIndex(m => m.id === currentMedia.id) : -1;
                    // At the end of the list
                    if (idx === mediaLibrary.length - 1) {
                        if (repeatMode === "none") {
                            // Go to first track but leave it paused (ready to replay)
                            const first = mediaLibrary[0];
                            if (first) {
                                set(state => ({
                                    currentMedia: first,
                                    playback: {
                                        ...state.playback,
                                        currentTime: 0,
                                        duration: 0,
                                        isPlaying: false,
                                    },
                                }));
                            } else {
                                set(state => ({ playback: { ...state.playback, isPlaying: false } }));
                            }
                        } else {
                            // "all" — wrap to first track
                            const first = mediaLibrary[0];
                            if (first) {
                                set(state => ({
                                    currentMedia: first,
                                    playback: {
                                        ...state.playback,
                                        currentTime: 0,
                                        duration: 0,
                                        isPlaying: true,
                                    },
                                }));
                            }
                        }
                        return;
                    }
                    const next = mediaLibrary[idx + 1];
                    if (next) {
                        set(state => ({
                            currentMedia: next,
                            playback: { ...state.playback, currentTime: 0, duration: 0, isPlaying: true },
                        }));
                    }
                },
                playPrevInLibrary: () => {
                    const { mediaLibrary, currentMedia, repeatMode, playback } = get();
                    if (!mediaLibrary.length) return;
                    const idx = currentMedia ? mediaLibrary.findIndex(m => m.id === currentMedia.id) : -1;
                    // Spotify-style: if more than 3 s into the track, restart it
                    if (playback.currentTime > 3) {
                        set(state => ({ playback: { ...state.playback, currentTime: 0 } }));
                        return;
                    }
                    // At the start of the list
                    if (idx <= 0) {
                        if (repeatMode === "all" && mediaLibrary.length > 1) {
                            // Wrap to last track
                            const last = mediaLibrary[mediaLibrary.length - 1];
                            if (last) {
                                set(state => ({
                                    currentMedia: last,
                                    playback: {
                                        ...state.playback,
                                        currentTime: 0,
                                        duration: 0,
                                        isPlaying: true,
                                    },
                                }));
                            }
                        } else {
                            // Restart first (or only) track from the beginning
                            set(state => ({ playback: { ...state.playback, currentTime: 0 } }));
                        }
                        return;
                    }
                    const prev = mediaLibrary[idx - 1];
                    if (prev) {
                        set(state => ({
                            currentMedia: prev,
                            playback: { ...state.playback, currentTime: 0, duration: 0, isPlaying: true },
                        }));
                    }
                },

                // UI State
                showEffectsPanel: false,
                showChaptersPanel: false,
                showAudioVisualizer: true,
                showModeSelector: false,
                showPlaylistPanel: false,
                toggleEffectsPanel: () => set(state => ({ showEffectsPanel: !state.showEffectsPanel })),
                toggleChaptersPanel: () => set(state => ({ showChaptersPanel: !state.showChaptersPanel })),
                toggleAudioVisualizer: () =>
                    set(state => ({ showAudioVisualizer: !state.showAudioVisualizer })),
                toggleModeSelector: () => set(state => ({ showModeSelector: !state.showModeSelector })),
                togglePlaylistPanel: () => set(state => ({ showPlaylistPanel: !state.showPlaylistPanel })),
            }),
            {
                name: "waldiez-player-storage",
                partialize: state => ({
                    mediaLibrary: state.mediaLibrary,
                    playerMode: state.playerMode,
                    repeatMode: state.repeatMode,
                    effects: state.effects.filter(e => !e.id.startsWith("mode-")),
                    playback: {
                        volume: state.playback.volume,
                        playbackRate: state.playback.playbackRate,
                        isLooping: state.playback.isLooping,
                    },
                }),
                // playerModeConfig is not persisted, so realign it with the
                // restored playerMode after hydration.
                onRehydrateStorage: () => state => {
                    if (state) {
                        const config = getModeConfig(state.playerMode);
                        if (config) state.playerModeConfig = config;
                    }
                },
            },
        ),
        { name: "PlayerStore" },
    ),
);
