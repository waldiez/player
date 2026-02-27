/**
 * MoodCustomizeDialog — lets the user personalise a mood's name and colours.
 * Changes are saved to wideria-prefs (under moodCustomizations) and take effect
 * immediately in WideriaLayout via the onSaved callback.
 */
import { loadMoodCustomizations, resetMoodCustomization, saveMoodCustomization } from "@/lib/moodDefaults";
import { cn } from "@/lib/utils";
import { MOOD_META, MOOD_MODES } from "@/types/mood";
import type { MoodMode } from "@/types/mood";

import { useEffect, useState } from "react";

import { X } from "lucide-react";

interface MoodCustomizeDialogProps {
    /** Pre-selected mode (current active mode). */
    initialMode: MoodMode;
    onClose: () => void;
    /** Called after a save or reset so the parent can re-read customizations. */
    onSaved: () => void;
}

function isValidHex(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export function MoodCustomizeDialog({ initialMode, onClose, onSaved }: MoodCustomizeDialogProps) {
    const [selectedMode, setSelectedMode] = useState<MoodMode>(initialMode);

    // Editable fields
    const [label, setLabel] = useState("");
    const [accent, setAccent] = useState("");
    const [bg, setBg] = useState("");
    // Text inputs (may be mid-typing, so kept separate from validated colour)
    const [accentText, setAccentText] = useState("");
    const [bgText, setBgText] = useState("");

    // Reload from storage when the selected mode tab changes
    useEffect(() => {
        const customs = loadMoodCustomizations();
        const custom = customs[selectedMode] ?? {};
        const defaults = MOOD_META[selectedMode];
        const a = custom.accent ?? defaults.accent;
        const b = custom.bg ?? defaults.bg;

        setLabel(custom.label ?? defaults.label);
        setAccent(a);
        setBg(b);
        setAccentText(a);
        setBgText(b);
    }, [selectedMode]);

    function handleAccentText(val: string) {
        setAccentText(val);
        if (isValidHex(val)) setAccent(val);
    }

    function handleBgText(val: string) {
        setBgText(val);
        if (isValidHex(val)) setBg(val);
    }

    function handleSave() {
        saveMoodCustomization(selectedMode, {
            label: label.trim() || MOOD_META[selectedMode].label,
            accent: isValidHex(accent) ? accent : MOOD_META[selectedMode].accent,
            bg: isValidHex(bg) ? bg : MOOD_META[selectedMode].bg,
        });
        onSaved();
        onClose();
    }

    function handleReset() {
        resetMoodCustomization(selectedMode);
        const defaults = MOOD_META[selectedMode];
        setLabel(defaults.label);
        setAccent(defaults.accent);
        setBg(defaults.bg);
        setAccentText(defaults.accent);
        setBgText(defaults.bg);
        onSaved();
    }

    const previewAccent = isValidHex(accent) ? accent : MOOD_META[selectedMode].accent;
    const previewBg = isValidHex(bg) ? bg : MOOD_META[selectedMode].bg;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-80 rounded-lg border border-[var(--color-player-border)] bg-[var(--color-player-surface)] p-5 shadow-2xl">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold tracking-wide text-[var(--color-player-text)]">
                        Customize Mood
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded p-0.5 text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Mode selector tabs */}
                <div className="mb-4 flex flex-wrap gap-1">
                    {MOOD_MODES.map(m => (
                        <button
                            key={m}
                            onClick={() => setSelectedMode(m)}
                            className={cn(
                                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-all",
                                m === selectedMode
                                    ? "bg-[var(--color-player-accent)] text-white"
                                    : "border border-[var(--color-player-border)] text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                            )}
                        >
                            {MOOD_META[m].label}
                        </button>
                    ))}
                </div>

                {/* Name */}
                <div className="mb-3">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-player-text-muted)]">
                        Name
                    </label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        maxLength={24}
                        className="w-full rounded border border-[var(--color-player-border)] bg-[var(--color-player-bg)] px-2.5 py-1.5 text-sm text-[var(--color-player-text)] outline-none focus:border-[var(--color-player-accent)]"
                    />
                </div>

                {/* Accent colour */}
                <div className="mb-3">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-player-text-muted)]">
                        Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={accent}
                            onChange={e => {
                                setAccent(e.target.value);
                                setAccentText(e.target.value);
                            }}
                            className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 p-0.5"
                            style={{ background: "none" }}
                        />
                        <input
                            type="text"
                            value={accentText}
                            onChange={e => handleAccentText(e.target.value)}
                            maxLength={7}
                            placeholder="#RRGGBB"
                            className={cn(
                                "flex-1 rounded border px-2.5 py-1.5 text-sm font-mono outline-none",
                                "bg-[var(--color-player-bg)] text-[var(--color-player-text)]",
                                isValidHex(accentText)
                                    ? "border-[var(--color-player-border)] focus:border-[var(--color-player-accent)]"
                                    : "border-red-500/60",
                            )}
                        />
                    </div>
                </div>

                {/* Background colour */}
                <div className="mb-4">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-player-text-muted)]">
                        Background Color
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={bg}
                            onChange={e => {
                                setBg(e.target.value);
                                setBgText(e.target.value);
                            }}
                            className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 p-0.5"
                            style={{ background: "none" }}
                        />
                        <input
                            type="text"
                            value={bgText}
                            onChange={e => handleBgText(e.target.value)}
                            maxLength={7}
                            placeholder="#RRGGBB"
                            className={cn(
                                "flex-1 rounded border px-2.5 py-1.5 text-sm font-mono outline-none",
                                "bg-[var(--color-player-bg)] text-[var(--color-player-text)]",
                                isValidHex(bgText)
                                    ? "border-[var(--color-player-border)] focus:border-[var(--color-player-accent)]"
                                    : "border-red-500/60",
                            )}
                        />
                    </div>
                </div>

                {/* Live preview swatch */}
                <div
                    className="mb-4 flex h-10 items-center justify-center rounded border border-[var(--color-player-border)] transition-colors"
                    style={{ background: previewBg }}
                    aria-label="Colour preview"
                >
                    <span className="text-sm font-semibold tracking-widest" style={{ color: previewAccent }}>
                        {label.trim() || MOOD_META[selectedMode].label}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleReset}
                        className="text-xs text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                        title="Restore MOOD_META defaults for this mood"
                    >
                        Reset to defaults
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="rounded px-3 py-1.5 text-xs text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="rounded bg-[var(--color-player-accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
