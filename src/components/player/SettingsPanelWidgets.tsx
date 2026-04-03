import { type UiSettings } from "@/lib/uiSettings";
import { cn } from "@/lib/utils";
import { fetchWeatherMood } from "@/lib/weatherMood";

import React, { useState } from "react";

import { Cloud } from "lucide-react";

export function SectionCard({
    icon,
    title,
    hint,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-player-border bg-player-surface p-4">
            <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 text-player-text-muted">{icon}</div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-player-text">{title}</div>
                    {hint && <p className="mt-1 text-xs leading-5 text-player-text-muted">{hint}</p>}
                </div>
            </div>
            <div className="space-y-3">{children}</div>
        </section>
    );
}

export function ToggleRow({
    checked,
    onChange,
    label,
    description,
    disabled = false,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
}) {
    return (
        <label
            className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-player-border bg-player-bg/40 px-3 py-2.5",
                disabled && "pointer-events-none opacity-50",
            )}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-player-border bg-player-bg"
            />
            <span className="min-w-0">
                <span className="block text-sm text-player-text">{label}</span>
                {description && (
                    <span className="mt-1 block text-xs leading-5 text-player-text-muted">{description}</span>
                )}
            </span>
        </label>
    );
}

interface WeatherMoodSectionProps {
    uiSettings: UiSettings;
    patchUiSettings: (patch: Partial<UiSettings>) => void;
}

export function WeatherMoodSection({ uiSettings, patchUiSettings }: WeatherMoodSectionProps) {
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function tryNow() {
        setLoading(true);
        setSuggestion(null);
        try {
            const result = await fetchWeatherMood();
            if (result) {
                setSuggestion(`${result.description} -> ${result.mood}`);
            } else {
                setSuggestion("Could not detect weather right now.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <SectionCard
            icon={<Cloud className="h-4 w-4" />}
            title="Weather Mood"
            hint="Optional mood suggestions based on your current weather."
        >
            <ToggleRow
                checked={uiSettings.weatherMoodEnabled}
                onChange={checked => patchUiSettings({ weatherMoodEnabled: checked })}
                label="Enable weather-based mood suggestion"
            />
            <ToggleRow
                checked={uiSettings.autoMoodOnStartup}
                onChange={checked => patchUiSettings({ autoMoodOnStartup: checked })}
                label="Auto-switch mood on startup"
                disabled={!uiSettings.weatherMoodEnabled}
            />
            <div className="flex items-center gap-2">
                <button
                    onClick={() => void tryNow()}
                    disabled={loading || !uiSettings.weatherMoodEnabled}
                    className="rounded bg-player-border px-3 py-2 text-xs text-player-text-muted hover:text-player-text disabled:opacity-50"
                >
                    {loading ? "Detecting..." : "Try now"}
                </button>
                {suggestion && <span className="text-[11px] text-player-accent">{suggestion}</span>}
            </div>
        </SectionCard>
    );
}
