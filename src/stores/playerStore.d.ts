import type { Bookmark, Chapter, MediaFile, PlaybackState, VideoEffect } from "@/types";

interface PlayerStore {
    currentMedia: MediaFile | null;
    mediaLibrary: MediaFile[];
    setCurrentMedia: (media: MediaFile | null) => void;
    addToLibrary: (media: MediaFile) => void;
    removeFromLibrary: (id: string) => void;
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
    chapters: Chapter[];
    bookmarks: Bookmark[];
    addChapter: (chapter: Chapter) => void;
    removeChapter: (id: string) => void;
    addBookmark: (bookmark: Bookmark) => void;
    removeBookmark: (id: string) => void;
    effects: VideoEffect[];
    addEffect: (effect: VideoEffect) => void;
    updateEffect: (id: string, updates: Partial<VideoEffect>) => void;
    removeEffect: (id: string) => void;
    toggleEffect: (id: string) => void;
    reorderEffects: (fromIndex: number, toIndex: number) => void;
    showEffectsPanel: boolean;
    showChaptersPanel: boolean;
    showAudioVisualizer: boolean;
    toggleEffectsPanel: () => void;
    toggleChaptersPanel: () => void;
    toggleAudioVisualizer: () => void;
}
export declare const usePlayerStore: import("zustand").UseBoundStore<
    Omit<
        Omit<import("zustand").StoreApi<PlayerStore>, "setState" | "devtools"> & {
            setState(
                partial:
                    | PlayerStore
                    | Partial<PlayerStore>
                    | ((state: PlayerStore) => PlayerStore | Partial<PlayerStore>),
                replace?: false | undefined,
                action?:
                    | (
                          | string
                          | {
                                [x: string]: unknown;
                                [x: number]: unknown;
                                [x: symbol]: unknown;
                                type: string;
                            }
                      )
                    | undefined,
            ): void;
            setState(
                state: PlayerStore | ((state: PlayerStore) => PlayerStore),
                replace: true,
                action?:
                    | (
                          | string
                          | {
                                [x: string]: unknown;
                                [x: number]: unknown;
                                [x: symbol]: unknown;
                                type: string;
                            }
                      )
                    | undefined,
            ): void;
            devtools: {
                cleanup: () => void;
            };
        },
        "setState" | "persist"
    > & {
        setState(
            partial:
                | PlayerStore
                | Partial<PlayerStore>
                | ((state: PlayerStore) => PlayerStore | Partial<PlayerStore>),
            replace?: false | undefined,
            action?:
                | (
                      | string
                      | {
                            [x: string]: unknown;
                            [x: number]: unknown;
                            [x: symbol]: unknown;
                            type: string;
                        }
                  )
                | undefined,
        ): unknown;
        setState(
            state: PlayerStore | ((state: PlayerStore) => PlayerStore),
            replace: true,
            action?:
                | (
                      | string
                      | {
                            [x: string]: unknown;
                            [x: number]: unknown;
                            [x: symbol]: unknown;
                            type: string;
                        }
                  )
                | undefined,
        ): unknown;
        persist: {
            setOptions: (
                options: Partial<
                    import("zustand/middleware").PersistOptions<
                        PlayerStore,
                        {
                            mediaLibrary: MediaFile[];
                            effects: VideoEffect[];
                            playback: {
                                volume: number;
                                playbackRate: number;
                                isLooping: boolean;
                            };
                        },
                        unknown
                    >
                >,
            ) => void;
            clearStorage: () => void;
            rehydrate: () => Promise<void> | void;
            hasHydrated: () => boolean;
            onHydrate: (fn: (state: PlayerStore) => void) => () => void;
            onFinishHydration: (fn: (state: PlayerStore) => void) => () => void;
            getOptions: () => Partial<
                import("zustand/middleware").PersistOptions<
                    PlayerStore,
                    {
                        mediaLibrary: MediaFile[];
                        effects: VideoEffect[];
                        playback: {
                            volume: number;
                            playbackRate: number;
                            isLooping: boolean;
                        };
                    },
                    unknown
                >
            >;
        };
    }
>;
export {};
