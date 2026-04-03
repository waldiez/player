import { Button, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MODE_CONFIGS, type PlayerMode, type PlayerModeConfig, getModeConfig } from "@/types";

import React from "react";

import {
    BookOpen,
    BookOpenText,
    Disc3,
    Film,
    Flame,
    GraduationCap,
    Orbit,
    PencilRuler,
    PlayCircle,
    Presentation,
    Sparkles,
    Wand2,
    Zap,
} from "lucide-react";

// eslint-disable-next-line react-refresh/only-export-components
export const MODE_ICONS: Record<PlayerMode, React.FC<{ className?: string }>> = {
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
    rock: Flame,
    pop: Wand2,
    disco: Sparkles,
};

interface ModeMenuDropdownProps {
    playerMode: PlayerMode;
    playerModeConfig: PlayerModeConfig;
    showModeMenu: boolean;
    onToggle: () => void;
    onClose: () => void;
    onModeSelect: (mode: PlayerMode) => void;
}

export function ModeMenuDropdown({
    playerMode,
    playerModeConfig,
    showModeMenu,
    onToggle,
    onClose,
    onModeSelect,
}: ModeMenuDropdownProps) {
    const CurrentModeIcon = MODE_ICONS[playerMode];
    const modes = Object.keys(MODE_CONFIGS) as PlayerMode[];

    return (
        <div className="relative">
            <Tooltip content={`Mode: ${playerModeConfig.name}`}>
                <Button variant="secondary" size="icon" onClick={onToggle}>
                    <CurrentModeIcon className="h-4 w-4" />
                </Button>
            </Tooltip>

            {showModeMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={onClose} />
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
                                        onModeSelect(m);
                                        onClose();
                                    }}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                                        isSelected ? "bg-player-accent text-white" : "hover:bg-player-border",
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
