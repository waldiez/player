import { cn } from "@/lib/utils";

import React from "react";

import { WandSparkles } from "lucide-react";

export function InspectorCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <WandSparkles className="h-3.5 w-3.5 text-amber-300" />
                {title}
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

export function Field({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
            </span>
            <input
                value={value}
                onChange={event => onChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/60"
            />
        </label>
    );
}

export function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
            </span>
            <select
                value={value}
                onChange={event => onChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-teal-400/60"
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function SegmentedChoiceField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <div className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
            </span>
            <div className="grid grid-cols-2 gap-2">
                {options.map(option => {
                    const active = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={cn(
                                "rounded-2xl border px-3 py-2 text-sm transition",
                                active
                                    ? "border-teal-400/70 bg-teal-400/15 text-white"
                                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function MiniAction({
    children,
    onClick,
    label,
}: {
    children: React.ReactNode;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={event => {
                event.stopPropagation();
                onClick();
            }}
            aria-label={label}
            className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-xs text-slate-300 transition hover:bg-white/10"
        >
            {children}
        </button>
    );
}
