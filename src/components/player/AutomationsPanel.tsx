/**
 * AutomationsPanel — right-side drawer for managing local automation rules.
 */
import {
    type AutomationAction,
    type AutomationRule,
    type AutomationTrigger,
    type WeatherConditionTrigger,
    actionSummary,
    triggerSummary,
} from "@/lib/automations";
import { cn } from "@/lib/utils";
import { MOOD_MODES, type MoodMode } from "@/types/mood";

import { useState } from "react";

import { Plus, Trash2, X, Zap } from "lucide-react";

interface AutomationsPanelProps {
    onClose: () => void;
    rules: AutomationRule[];
    onAdd: (rule: Omit<AutomationRule, "id">) => void;
    onRemove: (id: string) => void;
    onToggle: (id: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEATHER_CONDITIONS: WeatherConditionTrigger[] = [
    "sunny",
    "cloudy",
    "rainy",
    "stormy",
    "snowy",
    "windy",
];

const inputCls =
    "w-full rounded border border-player-border bg-player-bg px-2 py-1.5 text-xs text-player-text outline-none focus:border-player-accent";
const labelCls = "mb-0.5 block text-[10px] uppercase tracking-wide text-player-text-muted";

function emptyTrigger(): AutomationTrigger {
    return { kind: "time", hour: 8, minute: 0, days: [] };
}
function emptyAction(): AutomationAction {
    return { kind: "switchMood", mood: "storm" };
}

function AddForm({
    onSave,
    onCancel,
}: {
    onSave: (r: Omit<AutomationRule, "id">) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [trigger, setTrigger] = useState<AutomationTrigger>(emptyTrigger);
    const [action, setAction] = useState<AutomationAction>(emptyAction);

    function patchTrigger(patch: Partial<AutomationTrigger>) {
        setTrigger(prev => ({ ...prev, ...patch }) as AutomationTrigger);
    }

    function patchAction(patch: Partial<AutomationAction>) {
        setAction(prev => ({ ...prev, ...patch }));
    }

    function handleTriggerKindChange(kind: AutomationTrigger["kind"]) {
        switch (kind) {
            case "time":
                setTrigger({ kind: "time", hour: 8, minute: 0, days: [] });
                break;
            case "weather":
                setTrigger({ kind: "weather", condition: "sunny" });
                break;
            case "idle":
                setTrigger({ kind: "idle", afterMinutes: 10 });
                break;
            case "trackEnd":
                setTrigger({ kind: "trackEnd" });
                break;
        }
    }

    return (
        <div className="mt-3 rounded-lg border border-player-accent/40 bg-player-surface p-3 space-y-2">
            <div className="text-xs font-semibold mb-2">New Rule</div>

            <div>
                <label className={labelCls}>Name</label>
                <input
                    className={inputCls}
                    placeholder="My automation"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                />
            </div>

            {/* Trigger */}
            <div>
                <label className={labelCls}>Trigger</label>
                <select
                    className={inputCls}
                    value={trigger.kind}
                    onChange={e => handleTriggerKindChange(e.target.value as AutomationTrigger["kind"])}
                >
                    <option value="time">Time</option>
                    <option value="weather">Weather</option>
                    <option value="idle">Idle</option>
                    <option value="trackEnd">Track End</option>
                </select>
            </div>

            {trigger.kind === "time" && (
                <>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className={labelCls}>Hour (0–23)</label>
                            <input
                                type="number"
                                min={0}
                                max={23}
                                className={inputCls}
                                value={(trigger as { hour: number }).hour}
                                onChange={e => patchTrigger({ hour: Number(e.target.value) })}
                            />
                        </div>
                        <div className="flex-1">
                            <label className={labelCls}>Minute (0–59)</label>
                            <input
                                type="number"
                                min={0}
                                max={59}
                                className={inputCls}
                                value={(trigger as { minute: number }).minute}
                                onChange={e => patchTrigger({ minute: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Days (empty = every day)</label>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {WEEKDAYS.map((day, i) => {
                                const days = (trigger as { days: number[] }).days;
                                const on = days.includes(i);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() =>
                                            patchTrigger({
                                                days: on ? days.filter(d => d !== i) : [...days, i],
                                            })
                                        }
                                        className={cn(
                                            "rounded px-1.5 py-0.5 text-[10px]",
                                            on
                                                ? "bg-player-accent text-white"
                                                : "bg-player-border text-player-text-muted",
                                        )}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {trigger.kind === "weather" && (
                <div>
                    <label className={labelCls}>Condition</label>
                    <select
                        className={inputCls}
                        value={(trigger as { condition: string }).condition}
                        onChange={e => patchTrigger({ condition: e.target.value as WeatherConditionTrigger })}
                    >
                        {WEATHER_CONDITIONS.map(c => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {trigger.kind === "idle" && (
                <div>
                    <label className={labelCls}>Minutes idle</label>
                    <input
                        type="number"
                        min={1}
                        className={inputCls}
                        value={(trigger as { afterMinutes: number }).afterMinutes}
                        onChange={e => patchTrigger({ afterMinutes: Number(e.target.value) })}
                    />
                </div>
            )}

            {/* Action */}
            <div>
                <label className={labelCls}>Action</label>
                <select
                    className={inputCls}
                    value={action.kind}
                    onChange={e => patchAction({ kind: e.target.value as AutomationAction["kind"] })}
                >
                    <option value="switchMood">Switch Mood</option>
                    <option value="weatherMood">Weather Mood</option>
                    <option value="setVolume">Set Volume</option>
                    <option value="play">Play</option>
                    <option value="pause">Pause</option>
                    <option value="shuffle">Next Track</option>
                </select>
            </div>

            {action.kind === "switchMood" && (
                <div>
                    <label className={labelCls}>Mood</label>
                    <select
                        className={inputCls}
                        value={action.mood ?? "storm"}
                        onChange={e => patchAction({ mood: e.target.value as MoodMode })}
                    >
                        {MOOD_MODES.map(m => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {action.kind === "setVolume" && (
                <div>
                    <label className={labelCls}>Volume ({Math.round((action.volume ?? 0.7) * 100)}%)</label>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full"
                        value={action.volume ?? 0.7}
                        onChange={e => patchAction({ volume: Number(e.target.value) })}
                    />
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button
                    onClick={() => {
                        if (!name.trim()) return;
                        onSave({ name: name.trim(), enabled: true, trigger, action });
                    }}
                    className="flex-1 rounded bg-player-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                    Add Rule
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 rounded border border-player-border px-3 py-1.5 text-xs text-player-text-muted hover:bg-player-border"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

export function AutomationsPanel({ onClose, rules, onAdd, onRemove, onToggle }: AutomationsPanelProps) {
    const [showForm, setShowForm] = useState(false);

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-player-border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                    <Zap className="h-4 w-4" />
                    Automations
                </h2>
                <button
                    onClick={onClose}
                    className="rounded p-1 text-player-text-muted hover:bg-player-border hover:text-player-text"
                    aria-label="Close automations"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {rules.length === 0 && !showForm && (
                    <p className="text-xs text-player-text-muted">
                        No automations yet. Add a rule to trigger actions based on time, weather, idle state,
                        or track end.
                    </p>
                )}

                <div className="space-y-2">
                    {rules.map(rule => (
                        <div
                            key={rule.id}
                            className={cn(
                                "flex items-start gap-2 rounded-lg border p-3 transition-colors",
                                rule.enabled
                                    ? "border-player-accent/40 bg-player-surface"
                                    : "border-player-border bg-player-surface opacity-60",
                            )}
                        >
                            <input
                                type="checkbox"
                                checked={rule.enabled}
                                onChange={() => onToggle(rule.id)}
                                className="mt-0.5 h-4 w-4 rounded border-player-border bg-player-bg"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-player-text">{rule.name}</p>
                                <p className="text-[11px] text-player-text-muted">
                                    {triggerSummary(rule.trigger)}
                                </p>
                                <p className="text-[11px] text-player-accent">
                                    → {actionSummary(rule.action)}
                                </p>
                            </div>
                            <button
                                onClick={() => onRemove(rule.id)}
                                className="shrink-0 rounded p-1 text-player-text-muted hover:bg-red-500/10 hover:text-red-400"
                                aria-label="Delete rule"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>

                {showForm ? (
                    <AddForm
                        onSave={rule => {
                            onAdd(rule);
                            setShowForm(false);
                        }}
                        onCancel={() => setShowForm(false)}
                    />
                ) : (
                    <button
                        onClick={() => setShowForm(true)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-player-border py-2 text-xs text-player-text-muted transition-colors hover:border-player-accent/50 hover:text-player-text"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Rule
                    </button>
                )}
            </div>
        </div>
    );
}
