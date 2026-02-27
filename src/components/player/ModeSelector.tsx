import { Button, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MODE_CONFIGS, type PlayerMode, getModeConfig } from "@/types";

import { useState } from "react";

import {
    BookOpen,
    Check,
    ChevronDown,
    Disc2,
    Disc3,
    Film,
    Flame,
    GraduationCap,
    Guitar,
    Mic2,
    Orbit,
    PlayCircle,
    Presentation,
    Sparkles,
    Zap,
} from "lucide-react";

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
    rock: Guitar,
    pop: Mic2,
    disco: Disc2,
};

interface ModeSelectorProps {
    currentMode: PlayerMode;
    onModeChange: (mode: PlayerMode) => void;
    className?: string;
}

export function ModeSelector({ currentMode, onModeChange, className }: ModeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const currentConfig = getModeConfig(currentMode);
    const CurrentIcon = MODE_ICONS[currentMode];

    return (
        <div className={cn("relative", className)}>
            <Tooltip content="Player Mode">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2"
                >
                    <CurrentIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentConfig.name}</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
                </Button>
            </Tooltip>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    {/* Dropdown */}
                    <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-player-border bg-player-surface p-2 shadow-xl animate-fade-in">
                        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-player-text-muted">
                            Player Modes
                        </div>

                        {Object.values(MODE_CONFIGS).map(config => {
                            const Icon = MODE_ICONS[config.id];
                            const isSelected = config.id === currentMode;

                            return (
                                <button
                                    key={config.id}
                                    onClick={() => {
                                        onModeChange(config.id);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors",
                                        isSelected
                                            ? "bg-player-accent/20 text-player-accent"
                                            : "hover:bg-player-border/50",
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                                            isSelected ? "bg-player-accent text-white" : "bg-player-border",
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{config.name}</span>
                                            {isSelected && <Check className="h-4 w-4 text-player-accent" />}
                                        </div>
                                        <p className="mt-0.5 text-xs text-player-text-muted line-clamp-2">
                                            {config.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}

                        <div className="mt-2 border-t border-player-border pt-2 px-2">
                            <p className="text-xs text-player-text-muted">
                                Each mode adjusts visuals, controls, and audio to match the experience.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Compact mode selector for use in controls bar
 */
interface CompactModeSelectorProps {
    currentMode: PlayerMode;
    onModeChange: (mode: PlayerMode) => void;
    className?: string;
}

export function CompactModeSelector({ currentMode, onModeChange, className }: CompactModeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const CurrentIcon = MODE_ICONS[currentMode];

    return (
        <div className={cn("relative", className)}>
            <Tooltip content={`Mode: ${getModeConfig(currentMode).name}`}>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
                    <CurrentIcon className="h-4 w-4" />
                </Button>
            </Tooltip>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    <div className="absolute bottom-full right-0 z-50 mb-2 rounded-lg border border-player-border bg-player-surface p-1 shadow-xl animate-fade-in">
                        {Object.values(MODE_CONFIGS).map(config => {
                            const Icon = MODE_ICONS[config.id];
                            const isSelected = config.id === currentMode;

                            return (
                                <Tooltip key={config.id} content={config.description} side="left">
                                    <button
                                        onClick={() => {
                                            onModeChange(config.id);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                                            isSelected
                                                ? "bg-player-accent text-white"
                                                : "hover:bg-player-border",
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{config.name}</span>
                                    </button>
                                </Tooltip>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
