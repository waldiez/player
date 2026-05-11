import { Button, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MODE_GROUPS, type PlayerMode, getModeConfig } from "@/types";

import { useState } from "react";

import {
    BookOpen,
    BookOpenText,
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
                    <div className="absolute left-0 top-full z-50 mt-2 max-h-[min(80vh,600px)] w-72 overflow-y-auto rounded-lg border border-player-border bg-player-surface p-2 shadow-xl animate-fade-in">
                        {MODE_GROUPS.map((group, gi) => (
                            <div key={group.label}>
                                {gi > 0 && <div className="my-2 border-t border-player-border" />}
                                <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-player-text-muted">
                                    {group.label}
                                </div>
                                {group.modes.map(id => {
                                    const config = getModeConfig(id);
                                    const Icon = MODE_ICONS[id];
                                    const isSelected = id === currentMode;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => {
                                                onModeChange(id);
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
                                                    isSelected
                                                        ? "bg-player-accent text-white"
                                                        : "bg-player-border",
                                                )}
                                            >
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{config.name}</span>
                                                    {isSelected && (
                                                        <Check className="h-4 w-4 text-player-accent" />
                                                    )}
                                                </div>
                                                <p className="mt-0.5 line-clamp-2 text-xs text-player-text-muted">
                                                    {config.description}
                                                </p>
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

                    <div className="absolute bottom-full right-0 z-50 mb-2 max-h-[min(80vh,520px)] overflow-y-auto rounded-lg border border-player-border bg-player-surface p-1 shadow-xl animate-fade-in">
                        {MODE_GROUPS.map((group, gi) => (
                            <div key={group.label}>
                                {gi > 0 && <div className="my-1 border-t border-player-border" />}
                                <div className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-player-text-muted">
                                    {group.label}
                                </div>
                                {group.modes.map(id => {
                                    const config = getModeConfig(id);
                                    const Icon = MODE_ICONS[id];
                                    const isSelected = id === currentMode;
                                    return (
                                        <Tooltip key={id} content={config.description} side="left">
                                            <button
                                                onClick={() => {
                                                    onModeChange(id);
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
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
