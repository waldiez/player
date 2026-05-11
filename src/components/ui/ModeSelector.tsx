import { Button, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MODE_GROUPS, type PlayerMode, getModeConfig } from "@/types";

import { useState } from "react";

import {
    BookOpen,
    BookOpenText,
    Disc2,
    Disc3,
    Film,
    Flame,
    GraduationCap,
    Guitar,
    Mic2,
    Orbit,
    PencilRuler,
    PlayCircle,
    Presentation,
    SlidersHorizontal,
    Sparkles,
    Zap,
} from "lucide-react";

const MODE_ICONS: Record<PlayerMode, React.FC<{ className?: string }>> = {
    standard: PlayCircle,
    reader: BookOpenText,
    editor: PencilRuler,
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
    mixer: SlidersHorizontal,
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
                        <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(80vh,520px)] w-56 overflow-y-auto rounded-lg border border-player-border bg-player-surface p-1 shadow-xl">
                            {MODE_GROUPS.map((group, gi) => (
                                <div key={group.label}>
                                    {gi > 0 && <div className="my-1 border-t border-player-border" />}
                                    <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-player-text-muted">
                                        {group.label}
                                    </div>
                                    {group.modes.map(mode => {
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
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Non-compact: grouped grid view used in SettingsPanel
    return (
        <div className={cn("space-y-4", className)}>
            {MODE_GROUPS.map((group, gi) => (
                <div key={group.label}>
                    <label
                        className={cn(
                            "mb-2 block text-xs font-medium uppercase tracking-wider text-player-text-muted",
                            gi > 0 && "mt-2",
                        )}
                    >
                        {group.label}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {group.modes.map(mode => {
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
                                            className={cn(
                                                "text-sm font-medium",
                                                isSelected && "text-player-accent",
                                            )}
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
            ))}
        </div>
    );
}
