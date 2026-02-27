import { Button, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MODE_CONFIGS, type PlayerMode, getModeConfig } from "@/types";

import { useState } from "react";

import {
    BookOpen,
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
    compact?: boolean;
}

export function ModeSelector({ currentMode, onModeChange, className, compact = false }: ModeSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const currentConfig = getModeConfig(currentMode);
    const CurrentIcon = MODE_ICONS[currentMode];

    const modes = Object.keys(MODE_CONFIGS) as PlayerMode[];

    if (compact) {
        return (
            <div className={cn("relative", className)}>
                <Tooltip content={`Mode: ${currentConfig.name}`}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(!isOpen)}
                        className="relative"
                    >
                        <CurrentIcon className="h-4 w-4" />
                    </Button>
                </Tooltip>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-player-border bg-player-surface p-1 shadow-xl">
                            <div className="mb-2 border-b border-player-border px-3 py-2">
                                <span className="text-xs font-medium uppercase tracking-wider text-player-text-muted">
                                    Player Mode
                                </span>
                            </div>
                            {modes.map(mode => {
                                const config = getModeConfig(mode);
                                const Icon = MODE_ICONS[mode];
                                const isSelected = mode === currentMode;

                                return (
                                    <button
                                        key={mode}
                                        onClick={() => {
                                            onModeChange(mode);
                                            setIsOpen(false);
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
                                                    isSelected ? "text-white/70" : "text-player-text-muted",
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
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            <label className="text-sm font-medium text-player-text-muted">Player Mode</label>
            <div className="grid grid-cols-2 gap-2">
                {modes.map(mode => {
                    const config = getModeConfig(mode);
                    const Icon = MODE_ICONS[mode];
                    const isSelected = mode === currentMode;

                    return (
                        <button
                            key={mode}
                            onClick={() => onModeChange(mode)}
                            className={cn(
                                "flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
                                isSelected
                                    ? "border-player-accent bg-player-accent/10"
                                    : "border-player-border hover:border-player-accent/50 hover:bg-player-surface",
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-md",
                                    isSelected
                                        ? "bg-player-accent text-white"
                                        : "bg-player-border text-player-text-muted",
                                )}
                            >
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div
                                    className={cn("text-sm font-medium", isSelected && "text-player-accent")}
                                >
                                    {config.name}
                                </div>
                                <div className="truncate text-xs text-player-text-muted">
                                    {config.description}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
