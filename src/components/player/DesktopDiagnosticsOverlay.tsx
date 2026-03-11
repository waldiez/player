import {
    type DiagnosticEntry,
    clearDiagnostics,
    dismissDiagnostic,
    getRecentDiagnostics,
    subscribeDiagnostics,
} from "@/lib/diagnostics";
import { cn } from "@/lib/utils";

import { useEffect, useState } from "react";

import { CircleAlert, Info, TriangleAlert, X } from "lucide-react";

const LEVEL_STYLES: Record<DiagnosticEntry["level"], string> = {
    info: "border-sky-500/30 bg-sky-500/10 text-sky-100",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    error: "border-red-500/35 bg-red-500/10 text-red-100",
};

const LEVEL_ICON: Record<DiagnosticEntry["level"], React.ComponentType<{ className?: string }>> = {
    info: Info,
    warn: TriangleAlert,
    error: CircleAlert,
};

export function DesktopDiagnosticsOverlay() {
    const [items, setItems] = useState<DiagnosticEntry[]>(() => getRecentDiagnostics(3));

    useEffect(() => {
        const sync = () => setItems(getRecentDiagnostics(3));
        return subscribeDiagnostics(sync);
    }, []);

    if (items.length === 0) return null;

    return (
        <div className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2">
            {items.map(item => {
                const Icon = LEVEL_ICON[item.level];
                return (
                    <div
                        key={item.id}
                        className={cn(
                            "pointer-events-auto rounded-xl border px-3 py-2 shadow-2xl backdrop-blur",
                            LEVEL_STYLES[item.level],
                        )}
                    >
                        <div className="flex items-start gap-2">
                            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">{item.message}</div>
                                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/60">
                                    {item.area}
                                </div>
                                {item.detail && (
                                    <div className="mt-1 line-clamp-2 text-xs text-white/75">
                                        {item.detail}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="rounded p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                                onClick={() => dismissDiagnostic(item.id)}
                                aria-label="Dismiss diagnostic"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
            {items.length > 1 && (
                <div className="pointer-events-auto flex justify-end">
                    <button
                        type="button"
                        className="rounded-full border border-player-border bg-player-surface/90 px-3 py-1 text-xs text-player-text-muted transition hover:text-player-text"
                        onClick={() => clearDiagnostics()}
                    >
                        Clear diagnostics
                    </button>
                </div>
            )}
        </div>
    );
}
