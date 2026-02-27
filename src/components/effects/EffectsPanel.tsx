import { Button, Slider, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { nextWid } from "@/lib/wid";
import { usePlayerStore } from "@/stores";
import type { EffectDefinition, EffectType, VideoEffect } from "@/types";

import { useCallback, useState } from "react";

import {
    CircleDot,
    Contrast,
    Droplets,
    Layers,
    Palette,
    RotateCcw,
    Sparkles,
    Sun,
    Trash2,
    Zap,
} from "lucide-react";

const EFFECT_DEFINITIONS: EffectDefinition[] = [
    {
        type: "brightness",
        name: "Brightness",
        description: "Adjust the overall brightness",
        icon: "sun",
        parameters: [{ name: "value", type: "number", min: 0, max: 2, step: 0.01, defaultValue: 1 }],
    },
    {
        type: "contrast",
        name: "Contrast",
        description: "Adjust the contrast level",
        icon: "contrast",
        parameters: [{ name: "value", type: "number", min: 0, max: 2, step: 0.01, defaultValue: 1 }],
    },
    {
        type: "saturation",
        name: "Saturation",
        description: "Adjust color saturation",
        icon: "droplets",
        parameters: [{ name: "value", type: "number", min: 0, max: 2, step: 0.01, defaultValue: 1 }],
    },
    {
        type: "hue",
        name: "Hue Rotation",
        description: "Rotate the color hue",
        icon: "palette",
        parameters: [{ name: "value", type: "number", min: -180, max: 180, step: 1, defaultValue: 0 }],
    },
    {
        type: "blur",
        name: "Blur",
        description: "Apply gaussian blur",
        icon: "circle-dot",
        parameters: [{ name: "value", type: "number", min: 0, max: 20, step: 0.1, defaultValue: 0 }],
    },
    {
        type: "sharpen",
        name: "Sharpen",
        description: "Sharpen the image",
        icon: "zap",
        parameters: [{ name: "value", type: "number", min: 0, max: 2, step: 0.01, defaultValue: 0 }],
    },
    {
        type: "vignette",
        name: "Vignette",
        description: "Add a vignette effect",
        icon: "sparkles",
        parameters: [
            { name: "intensity", type: "number", min: 0, max: 1, step: 0.01, defaultValue: 0 },
            { name: "radius", type: "number", min: 0.1, max: 1, step: 0.01, defaultValue: 0.5 },
        ],
    },
];

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    sun: Sun,
    contrast: Contrast,
    droplets: Droplets,
    palette: Palette,
    "circle-dot": CircleDot,
    zap: Zap,
    sparkles: Sparkles,
};

interface EffectsPanelProps {
    className?: string;
}

export function EffectsPanel({ className }: EffectsPanelProps) {
    const { effects, addEffect, removeEffect, updateEffect, toggleEffect, reorderEffects } = usePlayerStore();

    const [showAddMenu, setShowAddMenu] = useState(false);

    const handleAddEffect = useCallback(
        (type: EffectType) => {
            const definition = EFFECT_DEFINITIONS.find(d => d.type === type);
            if (!definition) return;

            const parameters: Record<string, number | string | boolean> = {};
            definition.parameters.forEach(p => {
                parameters[p.name] = p.defaultValue;
            });

            addEffect({
                id: nextWid(),
                type,
                enabled: true,
                parameters,
            });
            setShowAddMenu(false);
        },
        [addEffect],
    );

    const availableEffects = EFFECT_DEFINITIONS.filter(def => !effects.some(e => e.type === def.type));

    return (
        <div className={cn("flex h-full flex-col", className)}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-player-border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                    <Layers className="h-4 w-4" />
                    Effects
                </h2>
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        disabled={availableEffects.length === 0}
                    >
                        <Layers className="mr-2 h-4 w-4" />
                        Add Effect
                    </Button>

                    {showAddMenu && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-player-border bg-player-surface p-1 shadow-lg">
                            {availableEffects.map(def => {
                                const Icon = ICON_MAP[def.icon] || Layers;
                                return (
                                    <button
                                        key={def.type}
                                        onClick={() => handleAddEffect(def.type)}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-player-border"
                                    >
                                        <Icon className="h-4 w-4" />
                                        {def.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Effects List */}
            <div className="flex-1 overflow-auto p-4">
                {effects.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-player-text-muted">
                        <div>
                            <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
                            <p className="text-sm">No effects applied</p>
                            <p className="mt-1 text-xs">Click "Add Effect" to get started</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {effects.map((effect, index) => {
                            const definition = EFFECT_DEFINITIONS.find(d => d.type === effect.type);
                            if (!definition) return null;

                            return (
                                <EffectCard
                                    key={effect.id}
                                    effect={effect}
                                    definition={definition}
                                    onUpdate={updates => updateEffect(effect.id, updates)}
                                    onToggle={() => toggleEffect(effect.id)}
                                    onRemove={() => removeEffect(effect.id)}
                                    canMoveUp={index > 0}
                                    canMoveDown={index < effects.length - 1}
                                    onMoveUp={() => reorderEffects(index, index - 1)}
                                    onMoveDown={() => reorderEffects(index, index + 1)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

interface EffectCardProps {
    effect: VideoEffect;
    definition: EffectDefinition;
    onUpdate: (updates: Partial<VideoEffect>) => void;
    onToggle: () => void;
    onRemove: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

function EffectCard({ effect, definition, onUpdate, onToggle, onRemove }: EffectCardProps) {
    const Icon = definition ? ICON_MAP[definition.icon] || Layers : Layers;

    const handleParameterChange = useCallback(
        (paramName: string, value: number) => {
            onUpdate({
                parameters: {
                    ...effect.parameters,
                    [paramName]: value,
                },
            });
        },
        [effect.parameters, onUpdate],
    );

    const handleReset = useCallback(() => {
        if (!definition) return;
        const parameters: Record<string, number | string | boolean> = {};
        definition.parameters.forEach(p => {
            parameters[p.name] = p.defaultValue;
        });
        onUpdate({ parameters });
    }, [definition, onUpdate]);

    return (
        <div
            className={cn(
                "rounded-lg border border-player-border bg-player-surface/50 p-3 transition-opacity",
                !effect.enabled && "opacity-50",
            )}
        >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggle}
                        className={cn(
                            "rounded p-1 transition-colors",
                            effect.enabled
                                ? "bg-player-accent text-white"
                                : "bg-player-border text-player-text-muted",
                        )}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                    <span className="font-medium">{definition?.name || effect.type}</span>
                </div>

                <div className="flex items-center gap-1">
                    <Tooltip content="Reset">
                        <button
                            onClick={handleReset}
                            className="rounded p-1 text-player-text-muted hover:bg-player-border hover:text-player-text"
                        >
                            <RotateCcw className="h-3 w-3" />
                        </button>
                    </Tooltip>
                    <Tooltip content="Remove">
                        <button
                            onClick={onRemove}
                            className="rounded p-1 text-player-text-muted hover:bg-player-error/20 hover:text-player-error"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Parameters */}
            {definition?.parameters.map(param => {
                const value = effect.parameters[param.name] as number;
                return (
                    <div key={param.name} className="mb-2 last:mb-0">
                        <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="capitalize text-player-text-muted">
                                {param.name.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <span className="font-mono text-player-text">
                                {typeof value === "number" ? value.toFixed(2) : value}
                            </span>
                        </div>
                        <Slider
                            value={[value]}
                            min={param.min ?? 0}
                            max={param.max ?? 1}
                            step={param.step ?? 0.01}
                            onValueChange={v => v[0] !== undefined && handleParameterChange(param.name, v[0])}
                            disabled={!effect.enabled}
                        />
                    </div>
                );
            })}
        </div>
    );
}
