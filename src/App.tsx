import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EffectsPanel } from "@/components/effects";
import { AddSourceDialog } from "@/components/player/AddSourceDialog";
import { AutomationsPanel } from "@/components/player/AutomationsPanel";
import { BottomNav } from "@/components/player/BottomNav";
import { DJView } from "@/components/player/DJView";
import { DesktopDiagnosticsOverlay } from "@/components/player/DesktopDiagnosticsOverlay";
import { EditorView } from "@/components/player/EditorView";
import { GuidedModeCanvas } from "@/components/player/GuidedModeCanvas";
import { MODE_ICONS, ModeMenuDropdown } from "@/components/player/ModeMenuDropdown";
import { MoodPlayer } from "@/components/player/MoodPlayer";
import type { MoodPlayerHandle } from "@/components/player/MoodPlayer";
import { PlaylistPanel } from "@/components/player/PlaylistPanel";
import { ReaderView } from "@/components/player/ReaderView";
import { ScreensaverOverlay } from "@/components/player/ScreensaverOverlay";
import { SearchBar } from "@/components/player/SearchBar";
import { SettingsPanel } from "@/components/player/SettingsPanel";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { WideriaLayout } from "@/components/player/WideriaLayout";
import { Button, Slider, Tooltip } from "@/components/ui";
import { useAutomations } from "@/hooks/useAutomations";
import { useMediaHandlers } from "@/hooks/useMediaHandlers";
import { useMediaSession } from "@/hooks/useMediaSession";
import { useMoodPersistence } from "@/hooks/useMoodPersistence";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useTauriTray } from "@/hooks/useTauriTray";
import { onPlayerControl, onSceneMood, postMoodChanged, postNowPlaying } from "@/lib/synapse";
import { type UiSettings, readUiSettings, writeUiSettings } from "@/lib/uiSettings";
import { useIdleTimer } from "@/lib/useIdleTimer";
import { cn } from "@/lib/utils";
import { getSuggestedMood } from "@/lib/weatherMood";
import { usePlayerStore, useReaderStore } from "@/stores";
import type { PlayerMode } from "@/types";
import type { MediaFile } from "@/types";
import type { MoodMode } from "@/types/mood";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    ChevronLeft,
    ChevronRight,
    Film,
    FolderOpen,
    Globe,
    ListMusic,
    Maximize2,
    Minimize2,
    Moon,
    Pause,
    Play,
    Repeat,
    Repeat1,
    RotateCcw,
    Settings,
    SkipBack,
    SkipForward,
    Volume1,
    Volume2,
    VolumeX,
    Wand2,
    Zap,
} from "lucide-react";

// ── Mood persistence bridge for the small-screen path ─────────────────────
// WideriaLayout calls useMoodPersistence itself; this covers the case where
// isMoodMode is true but isLargeScreen is false (App renders MoodPlayer).
function MoodPersistenceBridge({ mode }: { mode: MoodMode }) {
    useMoodPersistence(mode);
    return null;
}

export function App() {
    const {
        playerMode,
        playerModeConfig,
        setPlayerMode,
        currentMedia,
        playback,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleFullscreen,
        toggleLoop,
        setPlaybackRate,
        showEffectsPanel,
        toggleEffectsPanel,
        showPlaylistPanel,
        togglePlaylistPanel,
        currentPage,
        totalPages,
        nextPage,
        prevPage,
        sleepTimerMinutes,
        setSleepTimer,
        abLoop,
        setLoopPointA,
        setLoopPointB,
        clearAbLoop,
        repeatMode,
        cycleRepeatMode,
        playNextInLibrary,
        playPrevInLibrary,
    } = usePlayerStore();

    const [showSettings, setShowSettings] = useState(false);
    const [showAutomations, setShowAutomations] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showModeMenu, setShowModeMenu] = useState(false);
    const [showSleepMenu, setShowSleepMenu] = useState(false);
    const [showAddSource, setShowAddSource] = useState(false);
    const [isScreensaverActive, setIsScreensaverActive] = useState(false);
    const [uiSettings, setUiSettings] = useState<UiSettings>(readUiSettings);
    const containerRef = useRef<HTMLDivElement>(null);
    const currentReaderDocument = useReaderStore(s => s.currentDocument);
    // Ref to MoodPlayer so we can forward scrubber/keyboard seeks to YouTube
    const moodPlayerRef = useRef<MoodPlayerHandle>(null);

    const isMoodMode = (
        ["journey", "dock", "storm", "fest", "rock", "pop", "disco"] as PlayerMode[]
    ).includes(playerMode);
    const isGuidedMode = (["storyteller", "presentation", "learning"] as PlayerMode[]).includes(playerMode);
    const isReaderMode = playerMode === "reader";
    const isEditorMode = playerMode === "editor";
    const isMixerMode = playerMode === "mixer";

    // Notify SYNAPSE when mood mode changes so it can adapt its scene.
    useEffect(() => {
        if (isMoodMode) postMoodChanged(playerMode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerMode]);

    // Notify SYNAPSE when a new track starts playing.
    useEffect(() => {
        if (currentMedia && playback.isPlaying) {
            postNowPlaying(currentMedia.name ?? currentMedia.path);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMedia?.path]);

    // Sync theme CSS variables whenever playerMode changes
    useEffect(() => {
        const { theme } = playerModeConfig;
        const r = parseInt(theme.accent.slice(1, 3), 16);
        const g = parseInt(theme.accent.slice(3, 5), 16);
        const b = parseInt(theme.accent.slice(5, 7), 16);
        const root = document.documentElement;
        root.dataset.mode = playerMode;
        root.style.setProperty("--color-player-bg", theme.background);
        root.style.setProperty("--color-player-surface", theme.surface);
        root.style.setProperty("--color-player-accent", theme.accent);
        root.style.setProperty("--color-player-accent-hover", `rgba(${r},${g},${b},0.75)`);
        root.style.setProperty("--color-player-border", `rgba(${r},${g},${b},0.22)`);
        root.style.setProperty("--color-player-text", theme.text);
        root.style.setProperty("--color-player-text-muted", theme.textMuted);
    }, [playerMode, playerModeConfig]);

    // Get current mode icon
    const CurrentModeIcon = MODE_ICONS[playerMode];

    const { handleFileDrop, handleFileSelect } = useMediaHandlers();

    const formatTime = useCallback((seconds: number): string => {
        if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        }
        return `${m}:${s.toString().padStart(2, "0")}`;
    }, []);

    const handleSeek = useCallback(
        (value: number[]) => {
            const newTime = value[0];
            if (newTime !== undefined && isFinite(newTime)) {
                seek(newTime);
                moodPlayerRef.current?.seekTo(newTime);
            }
        },
        [seek],
    );

    const handleVolumeChange = useCallback(
        (value: number[]) => {
            const newVolume = value[0];
            if (newVolume !== undefined) {
                setVolume(newVolume);
            }
        },
        [setVolume],
    );

    const handleSkip = useCallback(
        (seconds: number) => {
            const newTime = Math.max(0, Math.min(playback.duration, playback.currentTime + seconds));
            seek(newTime);
            moodPlayerRef.current?.seekTo(newTime);
        },
        [playback.currentTime, playback.duration, seek],
    );

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            if (isReaderMode || isEditorMode || isMixerMode) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case " ":
                case "k":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "m":
                    e.preventDefault();
                    toggleMute();
                    break;
                case "f":
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case "l":
                    e.preventDefault();
                    if (isMoodMode) cycleRepeatMode();
                    else toggleLoop();
                    break;
                case "arrowleft":
                    e.preventDefault();
                    if (playerModeConfig.controls.navigationStyle === "page-based") {
                        prevPage();
                    } else {
                        handleSkip(e.shiftKey ? -10 : -5);
                    }
                    break;
                case "arrowright":
                    e.preventDefault();
                    if (playerModeConfig.controls.navigationStyle === "page-based") {
                        nextPage();
                    } else {
                        handleSkip(e.shiftKey ? 10 : 5);
                    }
                    break;
                case "arrowup":
                    e.preventDefault();
                    setVolume(Math.min(1, playback.volume + 0.1));
                    break;
                case "arrowdown":
                    e.preventDefault();
                    setVolume(Math.max(0, playback.volume - 0.1));
                    break;
                case "0":
                case "home":
                    e.preventDefault();
                    seek(0);
                    moodPlayerRef.current?.seekTo(0);
                    break;
                case ",":
                case "<":
                    e.preventDefault();
                    setPlaybackRate(Math.max(0.25, playback.playbackRate - 0.25));
                    break;
                case ".":
                case ">":
                    e.preventDefault();
                    setPlaybackRate(Math.min(2, playback.playbackRate + 0.25));
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        togglePlay,
        toggleMute,
        toggleFullscreen,
        toggleLoop,
        cycleRepeatMode,
        isMoodMode,
        handleSkip,
        setVolume,
        seek,
        setPlaybackRate,
        isEditorMode,
        isReaderMode,
        isMixerMode,
        playback.volume,
        playback.playbackRate,
        playerModeConfig,
        nextPage,
        prevPage,
    ]);

    // ── New feature hooks (must be called before any early returns) ────────
    useMediaSession();
    useTauriTray();
    const { rules: automationRules, addRule, removeRule, toggleRule } = useAutomations();

    // Weather mood on startup
    useEffect(() => {
        if (!uiSettings.weatherMoodEnabled || !uiSettings.autoMoodOnStartup) return;
        // Only apply if no saved mood preference (store default is "standard")
        const { playerMode: currentMode } = usePlayerStore.getState();
        if (currentMode !== "standard") return;
        getSuggestedMood()
            .then(mood => {
                usePlayerStore.getState().setPlayerMode(mood as PlayerMode);
            })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── SYNAPSE OS bridge ────────────────────────────────────────────────────
    // Listen for voice commands relayed from SYNAPSE (play/pause/next/prev…)
    useEffect(() => {
        return onPlayerControl(command => {
            const store = usePlayerStore.getState();
            switch (command) {
                case "play":
                    store.setPlayback({ isPlaying: true });
                    break;
                case "pause":
                    store.setPlayback({ isPlaying: false });
                    break;
                case "next":
                    store.playNextInLibrary();
                    break;
                case "prev":
                    store.playPrevInLibrary();
                    break;
                case "stop":
                    store.setPlayback({ isPlaying: false, currentTime: 0 });
                    break;
                case "volume_up":
                    store.setVolume(Math.min(1, store.playback.volume + 0.1));
                    break;
                case "volume_down":
                    store.setVolume(Math.max(0, store.playback.volume - 0.1));
                    break;
            }
        });
    }, []);

    // When SYNAPSE pushes a mood (e.g. from its own scene change), mirror it.
    useEffect(() => {
        return onSceneMood(mood => {
            const validMoods: PlayerMode[] = ["journey", "dock", "storm", "fest", "rock", "pop", "disco"];
            if (validMoods.includes(mood as PlayerMode)) {
                setPlayerMode(mood as PlayerMode);
            }
        });
    }, [setPlayerMode]);

    // Swipe gesture for non-mood mode
    const swipeHandlers = useSwipeGesture({
        onSwipeLeft: () => playNextInLibrary(),
        onSwipeRight: () => playPrevInLibrary(),
    });

    // ── Screensaver ────────────────────────────────────────────────────────
    const idleMs =
        uiSettings.screensaverEnabled && playback.isPlaying
            ? uiSettings.screensaverTimeoutMinutes * 60_000
            : null;
    useIdleTimer(idleMs, () => setIsScreensaverActive(true));

    useEffect(() => {
        if (!playback.isPlaying) setIsScreensaverActive(false);
    }, [playback.isPlaying]);

    const addMediaUrl = useCallback((entry: MediaFile) => {
        const store = usePlayerStore.getState();
        store.addToLibrary(entry);
        store.setCurrentMedia(entry);
        store.setPlayback({ currentTime: 0, duration: 0, isPlaying: true });
    }, []);

    const VolumeIcon =
        playback.isMuted || playback.volume === 0 ? VolumeX : playback.volume < 0.5 ? Volume1 : Volume2;
    const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const sleepOptions = playerModeConfig.behavior.sleepTimerOptions;

    // Check if we should show page controls
    const showPageControls =
        playerModeConfig.controls.showPageControls &&
        playerModeConfig.controls.navigationStyle === "page-based";

    // Mood modes always use the full WideriaLayout (responsive for all screen sizes)
    if (isMoodMode) {
        return (
            <ErrorBoundary label="Player">
                <>
                    <DesktopDiagnosticsOverlay />
                    <WideriaLayout
                        mode={playerMode as MoodMode}
                        onAutomationsOpen={() => setShowAutomations(true)}
                        pausePlaybackWhenHidden={uiSettings.pausePlaybackWhenHidden}
                        showYtFallbackDiagnostics={uiSettings.showYtFallbackDiagnostics}
                    />
                    {showAutomations && (
                        <div className="fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] animate-slide-right border-l border-player-border bg-player-surface shadow-2xl">
                            <AutomationsPanel
                                onClose={() => setShowAutomations(false)}
                                rules={automationRules}
                                onAdd={addRule}
                                onRemove={removeRule}
                                onToggle={toggleRule}
                            />
                        </div>
                    )}
                </>
            </ErrorBoundary>
        );
    }

    if (isGuidedMode) {
        return (
            <ErrorBoundary label="Player">
                <div className="flex h-full flex-col bg-player-bg">
                    <DesktopDiagnosticsOverlay />
                    <header className="flex h-12 items-center justify-between border-b border-player-border bg-player-surface px-4">
                        <div className="flex items-center gap-3">
                            <CurrentModeIcon className="h-4 w-4 text-player-accent" />
                            <div className="font-semibold">{playerModeConfig.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <SearchBar onAdd={addMediaUrl} />
                            <Button variant="ghost" size="icon" onClick={handleFileSelect}>
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    </header>
                    <div className="min-h-0 flex-1">
                        <GuidedModeCanvas
                            mode={playerMode as "storyteller" | "presentation" | "learning"}
                            currentMediaName={currentMedia?.name}
                            currentDocument={currentReaderDocument}
                            onOpenFiles={handleFileSelect}
                            onOpenReader={() => {
                                if (currentReaderDocument) {
                                    setPlayerMode("reader");
                                    return;
                                }
                                handleFileSelect();
                            }}
                            onOpenSettings={() => setShowSettings(true)}
                        >
                            <div className="flex h-full flex-col">
                                <div className="relative min-h-0 flex-1">
                                    <VideoPlayer className="h-full w-full" />
                                    {!playback.isPlaying && currentMedia && (
                                        <button
                                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-player-accent/80 p-6 transition-all hover:scale-110 hover:bg-player-accent"
                                            onClick={togglePlay}
                                        >
                                            <Play className="h-12 w-12 text-white" fill="white" />
                                        </button>
                                    )}
                                </div>
                                <div className="border-t border-player-border bg-player-surface p-4">
                                    <div className="mb-4">
                                        <Slider
                                            value={[playback.currentTime]}
                                            min={0}
                                            max={playback.duration || 1}
                                            step={0.1}
                                            onValueChange={handleSeek}
                                            className="w-full"
                                            disabled={!currentMedia}
                                        />
                                        <div className="mt-1 flex justify-between text-xs text-player-text-muted">
                                            <span>{formatTime(playback.currentTime)}</span>
                                            <span>{formatTime(playback.duration)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleSkip(-10)}
                                                disabled={!currentMedia}
                                            >
                                                <SkipBack className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={togglePlay}
                                                disabled={!currentMedia}
                                            >
                                                {playback.isPlaying ? (
                                                    <Pause className="h-6 w-6" />
                                                ) : (
                                                    <Play className="h-6 w-6" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleSkip(10)}
                                                disabled={!currentMedia}
                                            >
                                                <SkipForward className="h-4 w-4" />
                                            </Button>
                                            {playerModeConfig.controls.showPageControls && (
                                                <>
                                                    <div className="mx-2 h-6 w-px bg-player-border" />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={prevPage}
                                                        disabled={currentPage <= 1}
                                                    >
                                                        <ChevronLeft className="h-5 w-5" />
                                                    </Button>
                                                    <div className="text-sm text-player-text-muted">
                                                        Page {currentPage}/{totalPages}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={nextPage}
                                                        disabled={currentPage >= totalPages}
                                                    >
                                                        <ChevronRight className="h-5 w-5" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={toggleMute}>
                                                <VolumeIcon className="h-4 w-4" />
                                            </Button>
                                            <Slider
                                                value={[playback.isMuted ? 0 : playback.volume]}
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                onValueChange={handleVolumeChange}
                                                className="w-24"
                                            />
                                            {playerModeConfig.controls.sleepTimer && (
                                                <Button
                                                    variant={sleepTimerMinutes ? "default" : "ghost"}
                                                    size="icon"
                                                    onClick={() =>
                                                        setSleepTimer(
                                                            sleepTimerMinutes
                                                                ? null
                                                                : (sleepOptions[0] ?? 15),
                                                        )
                                                    }
                                                >
                                                    <Moon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {playerModeConfig.controls.abLoop && (
                                                <>
                                                    <Button variant="ghost" size="sm" onClick={setLoopPointA}>
                                                        A
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={setLoopPointB}
                                                        disabled={abLoop.a === null}
                                                    >
                                                        B
                                                    </Button>
                                                    {(abLoop.a !== null || abLoop.b !== null) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={clearAbLoop}
                                                        >
                                                            <Repeat1 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </GuidedModeCanvas>
                    </div>
                    {showSettings && (
                        <div className="fixed right-0 top-0 z-50 h-full w-96 max-w-[92vw] border-l border-player-border bg-player-surface shadow-2xl">
                            <SettingsPanel
                                onClose={() => setShowSettings(false)}
                                onUiSettingsChange={next => {
                                    setUiSettings(next);
                                    writeUiSettings(next);
                                }}
                                uiSettings={uiSettings}
                            />
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        );
    }

    if (isReaderMode) {
        return (
            <ErrorBoundary label="Reader">
                <>
                    <DesktopDiagnosticsOverlay />
                    <ReaderView onSettingsOpen={() => setShowSettings(true)} />
                    {showSettings && (
                        <div className="fixed right-0 top-0 z-50 h-full w-96 max-w-[92vw] border-l border-player-border bg-player-surface shadow-2xl">
                            <SettingsPanel
                                onClose={() => setShowSettings(false)}
                                onUiSettingsChange={next => {
                                    setUiSettings(next);
                                    writeUiSettings(next);
                                }}
                                uiSettings={uiSettings}
                            />
                        </div>
                    )}
                </>
            </ErrorBoundary>
        );
    }

    if (isEditorMode) {
        return (
            <ErrorBoundary label="Editor">
                <>
                    <DesktopDiagnosticsOverlay />
                    <EditorView onSettingsOpen={() => setShowSettings(true)} />
                    {showSettings && (
                        <div className="fixed right-0 top-0 z-50 h-full w-96 max-w-[92vw] border-l border-player-border bg-player-surface shadow-2xl">
                            <SettingsPanel
                                onClose={() => setShowSettings(false)}
                                onUiSettingsChange={next => {
                                    setUiSettings(next);
                                    writeUiSettings(next);
                                }}
                                uiSettings={uiSettings}
                            />
                        </div>
                    )}
                </>
            </ErrorBoundary>
        );
    }

    if (isMixerMode) {
        return (
            <ErrorBoundary label="Mixer">
                <>
                    <DesktopDiagnosticsOverlay />
                    <DJView onSettingsOpen={() => setShowSettings(true)} />
                    {showSettings && (
                        <div className="fixed right-0 top-0 z-50 h-full w-96 max-w-[92vw] border-l border-player-border bg-player-surface shadow-2xl">
                            <SettingsPanel
                                onClose={() => setShowSettings(false)}
                                onUiSettingsChange={next => {
                                    setUiSettings(next);
                                    writeUiSettings(next);
                                }}
                                uiSettings={uiSettings}
                            />
                        </div>
                    )}
                </>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary label="Player">
            <div
                ref={containerRef}
                className="flex h-full flex-col bg-player-bg"
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                {...swipeHandlers}
            >
                <DesktopDiagnosticsOverlay />
                {/* Header */}
                <header className="flex h-12 items-center justify-between border-b border-player-border bg-player-surface px-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Film className="h-5 w-5 text-player-accent" />
                            <span className="font-semibold">Waldiez Player</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentMedia && (
                            <span className="mr-4 max-w-[300px] truncate text-sm text-player-text-muted">
                                {currentMedia.name}
                            </span>
                        )}

                        {/* Player Mode Selector */}
                        <ModeMenuDropdown
                            playerMode={playerMode}
                            playerModeConfig={playerModeConfig}
                            showModeMenu={showModeMenu}
                            onToggle={() => setShowModeMenu(!showModeMenu)}
                            onClose={() => setShowModeMenu(false)}
                            onModeSelect={setPlayerMode}
                        />

                        <Tooltip content="Playlist">
                            <Button
                                variant={showPlaylistPanel ? "default" : "ghost"}
                                size="icon"
                                onClick={togglePlaylistPanel}
                            >
                                <ListMusic className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                        <SearchBar onAdd={addMediaUrl} />
                        <Tooltip content="Add URL (YouTube, Spotify, stream…)">
                            <Button variant="ghost" size="icon" onClick={() => setShowAddSource(true)}>
                                <Globe className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Open File">
                            <Button variant="ghost" size="icon" onClick={handleFileSelect}>
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Effects">
                            <Button
                                variant={showEffectsPanel ? "default" : "ghost"}
                                size="icon"
                                onClick={toggleEffectsPanel}
                            >
                                <Wand2 className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Automations">
                            <Button
                                variant={showAutomations ? "default" : "ghost"}
                                size="icon"
                                onClick={() => setShowAutomations(!showAutomations)}
                            >
                                <Zap className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                        <Tooltip content="Settings">
                            <Button
                                variant={showSettings ? "default" : "ghost"}
                                size="icon"
                                onClick={() => setShowSettings(!showSettings)}
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Video Area */}
                    <div className="flex flex-1 flex-col">
                        <div className="relative flex-1">
                            {/* Load/save playlists for mood modes on small screens */}
                            {isMoodMode && <MoodPersistenceBridge mode={playerMode as MoodMode} />}
                            {isMoodMode ? (
                                <MoodPlayer
                                    ref={moodPlayerRef}
                                    mode={playerMode as MoodMode}
                                    className="h-full w-full"
                                    pausePlaybackWhenHidden={uiSettings.pausePlaybackWhenHidden}
                                />
                            ) : isGuidedMode ? (
                                <GuidedModeCanvas
                                    mode={playerMode as "storyteller" | "presentation" | "learning"}
                                    currentMediaName={currentMedia?.name}
                                    currentDocument={currentReaderDocument}
                                    onOpenFiles={handleFileSelect}
                                    onOpenReader={() => {
                                        if (currentReaderDocument) {
                                            setPlayerMode("reader");
                                            return;
                                        }
                                        handleFileSelect();
                                    }}
                                    onOpenSettings={() => setShowSettings(true)}
                                >
                                    <VideoPlayer className="h-full w-full" />
                                </GuidedModeCanvas>
                            ) : (
                                <VideoPlayer className="h-full w-full" />
                            )}

                            {/* Center Play Button Overlay */}
                            {!playback.isPlaying && currentMedia && (
                                <button
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-player-accent/80 p-6 transition-all hover:scale-110 hover:bg-player-accent"
                                    onClick={togglePlay}
                                >
                                    <Play className="h-12 w-12 text-white" fill="white" />
                                </button>
                            )}

                            {/* Page indicator for audiobook/presentation modes */}
                            {showPageControls && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-player-surface/80 px-4 py-2">
                                    <span className="text-sm font-medium">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Controls Bar */}
                        <div className="border-t border-player-border bg-player-surface p-4">
                            {/* Progress Bar */}
                            <div className="mb-4">
                                <Slider
                                    value={[playback.currentTime]}
                                    min={0}
                                    max={playback.duration || 1}
                                    step={0.1}
                                    onValueChange={handleSeek}
                                    className="w-full"
                                    disabled={!currentMedia}
                                />
                                <div className="mt-1 flex justify-between text-xs text-player-text-muted">
                                    <span>{formatTime(playback.currentTime)}</span>
                                    <span>{formatTime(playback.duration)}</span>
                                </div>
                            </div>

                            {/* Control Buttons */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    {/* Page controls for audiobook mode */}
                                    {showPageControls ? (
                                        <>
                                            <Tooltip content="Previous Page (←)">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={prevPage}
                                                    disabled={currentPage <= 1}
                                                >
                                                    <ChevronLeft className="h-5 w-5" />
                                                </Button>
                                            </Tooltip>

                                            <Tooltip
                                                content={
                                                    playback.isPlaying ? "Pause (Space)" : "Play (Space)"
                                                }
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={togglePlay}
                                                    disabled={!currentMedia}
                                                    className="mx-1"
                                                >
                                                    {playback.isPlaying ? (
                                                        <Pause className="h-6 w-6" />
                                                    ) : (
                                                        <Play className="h-6 w-6" />
                                                    )}
                                                </Button>
                                            </Tooltip>

                                            <Tooltip content="Next Page (→)">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={nextPage}
                                                    disabled={currentPage >= totalPages}
                                                >
                                                    <ChevronRight className="h-5 w-5" />
                                                </Button>
                                            </Tooltip>
                                        </>
                                    ) : (
                                        <>
                                            {/* Standard video controls */}
                                            <Tooltip content="Skip Back 10s">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSkip(-10)}
                                                    disabled={!currentMedia}
                                                >
                                                    <SkipBack className="h-4 w-4" />
                                                </Button>
                                            </Tooltip>

                                            <Tooltip content="Rewind 5s (←)">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSkip(-5)}
                                                    disabled={!currentMedia}
                                                >
                                                    <ChevronLeft className="h-5 w-5" />
                                                </Button>
                                            </Tooltip>

                                            <Tooltip
                                                content={
                                                    playback.isPlaying ? "Pause (Space)" : "Play (Space)"
                                                }
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={togglePlay}
                                                    disabled={!currentMedia}
                                                    className="mx-1"
                                                >
                                                    {playback.isPlaying ? (
                                                        <Pause className="h-6 w-6" />
                                                    ) : (
                                                        <Play className="h-6 w-6" />
                                                    )}
                                                </Button>
                                            </Tooltip>

                                            <Tooltip content="Forward 5s (→)">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSkip(5)}
                                                    disabled={!currentMedia}
                                                >
                                                    <ChevronRight className="h-5 w-5" />
                                                </Button>
                                            </Tooltip>

                                            <Tooltip content="Skip Forward 10s">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSkip(10)}
                                                    disabled={!currentMedia}
                                                >
                                                    <SkipForward className="h-4 w-4" />
                                                </Button>
                                            </Tooltip>
                                        </>
                                    )}

                                    <div className="mx-2 h-6 w-px bg-player-border" />

                                    {/* Volume */}
                                    <div className="flex items-center gap-2">
                                        <Tooltip content={playback.isMuted ? "Unmute (M)" : "Mute (M)"}>
                                            <Button variant="ghost" size="icon" onClick={toggleMute}>
                                                <VolumeIcon className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                        <Slider
                                            value={[playback.isMuted ? 0 : playback.volume]}
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            onValueChange={handleVolumeChange}
                                            className="w-24"
                                        />
                                    </div>

                                    {/* Restart */}
                                    <Tooltip content="Restart">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => seek(0)}
                                            disabled={!currentMedia}
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                    </Tooltip>

                                    {/* A-B Loop (Learning mode) */}
                                    {playerModeConfig.controls.abLoop && (
                                        <>
                                            <div className="mx-2 h-6 w-px bg-player-border" />
                                            <Tooltip
                                                content={
                                                    abLoop.a !== null
                                                        ? `A: ${formatTime(abLoop.a)}`
                                                        : "Set Loop Point A"
                                                }
                                            >
                                                <Button
                                                    variant={abLoop.a !== null ? "default" : "ghost"}
                                                    size="sm"
                                                    onClick={setLoopPointA}
                                                    disabled={!currentMedia}
                                                >
                                                    A
                                                </Button>
                                            </Tooltip>
                                            <Tooltip
                                                content={
                                                    abLoop.b !== null
                                                        ? `B: ${formatTime(abLoop.b)}`
                                                        : "Set Loop Point B"
                                                }
                                            >
                                                <Button
                                                    variant={abLoop.b !== null ? "default" : "ghost"}
                                                    size="sm"
                                                    onClick={setLoopPointB}
                                                    disabled={!currentMedia || abLoop.a === null}
                                                >
                                                    B
                                                </Button>
                                            </Tooltip>
                                            {(abLoop.a !== null || abLoop.b !== null) && (
                                                <Tooltip content="Clear A-B Loop">
                                                    <Button variant="ghost" size="icon" onClick={clearAbLoop}>
                                                        <Repeat1 className="h-4 w-4" />
                                                    </Button>
                                                </Tooltip>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Sleep Timer (Storyteller/Audiobook modes) */}
                                    {playerModeConfig.controls.sleepTimer && sleepOptions.length > 0 && (
                                        <div className="relative">
                                            <Tooltip
                                                content={
                                                    sleepTimerMinutes
                                                        ? `Sleep in ${sleepTimerMinutes}min`
                                                        : "Sleep Timer"
                                                }
                                            >
                                                <Button
                                                    variant={sleepTimerMinutes ? "default" : "ghost"}
                                                    size="icon"
                                                    onClick={() => setShowSleepMenu(!showSleepMenu)}
                                                >
                                                    <Moon className="h-4 w-4" />
                                                </Button>
                                            </Tooltip>
                                            {showSleepMenu && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-40"
                                                        onClick={() => setShowSleepMenu(false)}
                                                    />
                                                    <div className="absolute bottom-full right-0 z-50 mb-2 rounded-lg border border-player-border bg-player-surface p-1 shadow-lg">
                                                        {sleepTimerMinutes && (
                                                            <button
                                                                onClick={() => {
                                                                    setSleepTimer(null);
                                                                    setShowSleepMenu(false);
                                                                }}
                                                                className="block w-full rounded px-3 py-1 text-left text-sm text-player-accent hover:bg-player-border"
                                                            >
                                                                Cancel Timer
                                                            </button>
                                                        )}
                                                        {sleepOptions.map(mins => (
                                                            <button
                                                                key={mins}
                                                                onClick={() => {
                                                                    setSleepTimer(mins);
                                                                    setShowSleepMenu(false);
                                                                }}
                                                                className={cn(
                                                                    "block w-full rounded px-3 py-1 text-left text-sm hover:bg-player-border",
                                                                    sleepTimerMinutes === mins &&
                                                                        "bg-player-accent text-white",
                                                                )}
                                                            >
                                                                {mins} minutes
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Loop / Repeat */}
                                    {isMoodMode ? (
                                        <Tooltip
                                            content={
                                                repeatMode === "none"
                                                    ? "Repeat off (L)"
                                                    : repeatMode === "all"
                                                      ? "Repeat all (L)"
                                                      : "Repeat one (L)"
                                            }
                                        >
                                            <Button
                                                variant={repeatMode !== "none" ? "default" : "ghost"}
                                                size="icon"
                                                onClick={cycleRepeatMode}
                                            >
                                                {repeatMode === "one" ? (
                                                    <Repeat1 className="h-4 w-4" />
                                                ) : (
                                                    <Repeat className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </Tooltip>
                                    ) : (
                                        <Tooltip
                                            content={
                                                playback.isLooping ? "Disable Loop (L)" : "Enable Loop (L)"
                                            }
                                        >
                                            <Button
                                                variant={playback.isLooping ? "default" : "ghost"}
                                                size="icon"
                                                onClick={toggleLoop}
                                            >
                                                <Repeat className="h-4 w-4" />
                                            </Button>
                                        </Tooltip>
                                    )}

                                    {/* Playback Speed */}
                                    {playerModeConfig.controls.showPlaybackSpeed && (
                                        <div className="relative">
                                            <Tooltip content="Playback Speed">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                                    className="min-w-[50px] font-mono"
                                                >
                                                    {playback.playbackRate}x
                                                </Button>
                                            </Tooltip>
                                            {showSpeedMenu && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-40"
                                                        onClick={() => setShowSpeedMenu(false)}
                                                    />
                                                    <div className="absolute bottom-full right-0 z-50 mb-2 rounded-lg border border-player-border bg-player-surface p-1 shadow-lg">
                                                        {speedOptions.map(speed => (
                                                            <button
                                                                key={speed}
                                                                onClick={() => {
                                                                    setPlaybackRate(speed);
                                                                    setShowSpeedMenu(false);
                                                                }}
                                                                className={cn(
                                                                    "block w-full rounded px-3 py-1 text-left text-sm hover:bg-player-border",
                                                                    playback.playbackRate === speed &&
                                                                        "bg-player-accent text-white",
                                                                )}
                                                            >
                                                                {speed}x
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Fullscreen */}
                                    <Tooltip
                                        content={
                                            playback.isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"
                                        }
                                    >
                                        <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                                            {playback.isFullscreen ? (
                                                <Minimize2 className="h-4 w-4" />
                                            ) : (
                                                <Maximize2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Effects Panel */}
                    {showEffectsPanel && (
                        <div className="w-80 animate-fade-in border-l border-player-border bg-player-surface">
                            <EffectsPanel />
                        </div>
                    )}

                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="w-80 animate-fade-in border-l border-player-border bg-player-surface">
                            <SettingsPanel
                                onClose={() => setShowSettings(false)}
                                onUiSettingsChange={next => {
                                    setUiSettings(next);
                                    writeUiSettings(next);
                                }}
                                uiSettings={uiSettings}
                            />
                        </div>
                    )}

                    {/* Automations Panel */}
                    {showAutomations && (
                        <div className="w-80 animate-fade-in border-l border-player-border bg-player-surface">
                            <AutomationsPanel
                                onClose={() => setShowAutomations(false)}
                                rules={automationRules}
                                onAdd={addRule}
                                onRemove={removeRule}
                                onToggle={toggleRule}
                            />
                        </div>
                    )}
                </div>

                {/* Playlist drawer (fixed overlay) */}
                {showPlaylistPanel && <PlaylistPanel />}

                {/* Add-source dialog */}
                {showAddSource && <AddSourceDialog onClose={() => setShowAddSource(false)} />}

                {/* Mobile bottom nav */}
                <BottomNav
                    onSearchOpen={() => {
                        /* SearchBar handles its own open state */
                    }}
                    onSettingsOpen={() => setShowSettings(true)}
                    onMoodsOpen={() => setShowModeMenu(true)}
                />

                {/* Screensaver overlay */}
                {isScreensaverActive && (
                    <ScreensaverOverlay
                        media={currentMedia}
                        mode={playerMode}
                        currentTime={playback.currentTime}
                        duration={playback.duration}
                        style={uiSettings.screensaverStyle}
                        onDismiss={() => setIsScreensaverActive(false)}
                    />
                )}
            </div>
        </ErrorBoundary>
    );
}

export default App;
