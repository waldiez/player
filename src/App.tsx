import { EffectsPanel } from "@/components/effects";
import { AddSourceDialog } from "@/components/player/AddSourceDialog";
import { MoodPlayer } from "@/components/player/MoodPlayer";
import type { MoodPlayerHandle } from "@/components/player/MoodPlayer";
import { PlaylistPanel } from "@/components/player/PlaylistPanel";
import { SettingsPanel } from "@/components/player/SettingsPanel";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { WideriaLayout } from "@/components/player/WideriaLayout";
import { Button, Slider, Tooltip } from "@/components/ui";
import { useMoodPersistence } from "@/hooks/useMoodPersistence";
import { cn } from "@/lib/utils";
import { nextWid } from "@/lib/wid";
import { usePlayerStore } from "@/stores";
import { MODE_CONFIGS, type PlayerMode, getModeConfig } from "@/types";
import type { MoodMode } from "@/types/mood";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Disc3,
    Film,
    Flame,
    FolderOpen,
    Globe,
    GraduationCap,
    ListMusic,
    Maximize2,
    Minimize2,
    Moon,
    Orbit,
    Pause,
    Play,
    PlayCircle,
    Presentation,
    Repeat,
    Repeat1,
    RotateCcw,
    Settings,
    SkipBack,
    SkipForward,
    Sparkles,
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

const MODE_ICONS: Record<PlayerMode, React.FC<{ className?: string }>> = {
    standard: PlayCircle,
    storyteller: Flame,
    audiobook: BookOpen,
    cinema: Film,
    presentation: Presentation,
    learning: GraduationCap,
    journey: Orbit,
    dock: Disc3,
    storm: Zap,
    fest: Sparkles,
    rock: Flame,
    pop: Wand2,
    disco: Sparkles,
};

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
    } = usePlayerStore();

    const [showSettings, setShowSettings] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showModeMenu, setShowModeMenu] = useState(false);
    const [showSleepMenu, setShowSleepMenu] = useState(false);
    const [showAddSource, setShowAddSource] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    // Ref to MoodPlayer so we can forward scrubber/keyboard seeks to YouTube
    const moodPlayerRef = useRef<MoodPlayerHandle>(null);

    const isMoodMode = (
        ["journey", "dock", "storm", "fest", "rock", "pop", "disco"] as PlayerMode[]
    ).includes(playerMode);

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
        playback.volume,
        playback.playbackRate,
        playerModeConfig,
        nextPage,
        prevPage,
    ]);

    const addMedia = useCallback((file: File) => {
        const store = usePlayerStore.getState();
        const url = URL.createObjectURL(file);
        const entry = {
            id: nextWid(),
            name: file.name,
            path: url,
            type: (file.type.startsWith("video/") ? "video" : "audio") as "video" | "audio",
            duration: 0,
            size: file.size,
            createdAt: new Date(),
        };
        store.addToLibrary(entry);
        store.setCurrentMedia(entry);
    }, []);

    const handleFileDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter(
                f => f.type.startsWith("video/") || f.type.startsWith("audio/"),
            );
            files.forEach(addMedia);
        },
        [addMedia],
    );

    const handleFileSelect = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*,audio/*";
        input.multiple = true;
        input.onchange = e => {
            const files = Array.from((e.target as HTMLInputElement).files ?? []);
            files.forEach(addMedia);
        };
        input.click();
    }, [addMedia]);

    const VolumeIcon =
        playback.isMuted || playback.volume === 0 ? VolumeX : playback.volume < 0.5 ? Volume1 : Volume2;

    // Mood modes always use the full WideriaLayout (responsive for all screen sizes)
    if (isMoodMode) {
        return <WideriaLayout mode={playerMode as MoodMode} />;
    }

    const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const sleepOptions = playerModeConfig.behavior.sleepTimerOptions;
    const modes = Object.keys(MODE_CONFIGS) as PlayerMode[];

    // Check if we should show page controls
    const showPageControls =
        playerModeConfig.controls.showPageControls &&
        playerModeConfig.controls.navigationStyle === "page-based";

    return (
        <div
            ref={containerRef}
            className="flex h-screen flex-col bg-player-bg"
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
        >
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
                    <div className="relative">
                        <Tooltip content={`Mode: ${playerModeConfig.name}`}>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={() => setShowModeMenu(!showModeMenu)}
                            >
                                <CurrentModeIcon className="h-4 w-4" />
                            </Button>
                        </Tooltip>

                        {showModeMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-player-border bg-player-surface p-1 shadow-xl">
                                    <div className="mb-2 border-b border-player-border px-3 py-2">
                                        <span className="text-xs font-medium uppercase tracking-wider text-player-text-muted">
                                            Player Mode
                                        </span>
                                    </div>
                                    {modes.map(m => {
                                        const config = getModeConfig(m);
                                        const Icon = MODE_ICONS[m];
                                        const isSelected = m === playerMode;

                                        return (
                                            <button
                                                key={m}
                                                onClick={() => {
                                                    setPlayerMode(m);
                                                    setShowModeMenu(false);
                                                }}
                                                className={cn(
                                                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                                                    isSelected
                                                        ? "bg-player-accent text-white"
                                                        : "hover:bg-player-border",
                                                )}
                                            >
                                                <Icon className="h-4 w-4 flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium">{config.name}</div>
                                                    <div
                                                        className={cn(
                                                            "truncate text-xs",
                                                            isSelected
                                                                ? "text-white/70"
                                                                : "text-player-text-muted",
                                                        )}
                                                    >
                                                        {config.description}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <Tooltip content="Playlist">
                        <Button
                            variant={showPlaylistPanel ? "default" : "ghost"}
                            size="icon"
                            onClick={togglePlaylistPanel}
                        >
                            <ListMusic className="h-4 w-4" />
                        </Button>
                    </Tooltip>
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
                            />
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
                                            content={playback.isPlaying ? "Pause (Space)" : "Play (Space)"}
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
                                            content={playback.isPlaying ? "Pause (Space)" : "Play (Space)"}
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
                                        content={playback.isLooping ? "Disable Loop (L)" : "Enable Loop (L)"}
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
                                    content={playback.isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
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
                        <SettingsPanel onClose={() => setShowSettings(false)} />
                    </div>
                )}
            </div>

            {/* Playlist drawer (fixed overlay) */}
            {showPlaylistPanel && <PlaylistPanel />}

            {/* Add-source dialog */}
            {showAddSource && <AddSourceDialog onClose={() => setShowAddSource(false)} />}
        </div>
    );
}

export default App;
