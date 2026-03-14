import { getRuntimeContext } from "@/lib/runtime";

export type DiagnosticLevel = "info" | "warn" | "error";

export interface DiagnosticEntry {
    id: string;
    level: DiagnosticLevel;
    area: string;
    message: string;
    detail?: string;
    createdAt: string;
    runtime: ReturnType<typeof getRuntimeContext>["kind"];
}

const STORAGE_KEY = "waldiez:diagnostics";
const MAX_ENTRIES = 40;

let entries: DiagnosticEntry[] = [];
const listeners = new Set<() => void>();
let hydrated = false;

function notify(): void {
    for (const listener of listeners) listener();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("waldiez:diagnostics"));
    }
}

function persist(): void {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // Ignore storage failures.
    }
}

function hydrate(): void {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        entries = parsed
            .filter(
                item =>
                    item &&
                    typeof item === "object" &&
                    typeof item.id === "string" &&
                    typeof item.message === "string" &&
                    typeof item.area === "string" &&
                    typeof item.level === "string" &&
                    typeof item.createdAt === "string",
            )
            .slice(-MAX_ENTRIES) as DiagnosticEntry[];
    } catch {
        entries = [];
    }
}

function toDetail(detail: unknown): string | undefined {
    if (detail === null || detail === undefined) return undefined;
    if (typeof detail === "string") return detail.trim() || undefined;
    if (detail instanceof Error) return detail.message || detail.name;
    try {
        return JSON.stringify(detail);
    } catch {
        return String(detail);
    }
}

function buildId(): string {
    return `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function reportDiagnostic(input: {
    level: DiagnosticLevel;
    area: string;
    message: string;
    detail?: unknown;
}): DiagnosticEntry {
    hydrate();
    const existing = entries.find(e => e.message === input.message && e.area === input.area);
    if (existing) return existing;
    const entry: DiagnosticEntry = {
        id: buildId(),
        level: input.level,
        area: input.area,
        message: input.message,
        detail: toDetail(input.detail),
        createdAt: new Date().toISOString(),
        runtime: getRuntimeContext().kind,
    };
    entries = [...entries, entry].slice(-MAX_ENTRIES);
    persist();
    notify();
    return entry;
}

export function getDiagnostics(): DiagnosticEntry[] {
    hydrate();
    return entries;
}

export function getRecentDiagnostics(limit = 8): DiagnosticEntry[] {
    hydrate();
    return entries.slice(-Math.max(1, limit)).reverse();
}

export function dismissDiagnostic(id: string): void {
    hydrate();
    entries = entries.filter(entry => entry.id !== id);
    persist();
    notify();
}

export function clearDiagnostics(): void {
    hydrate();
    entries = [];
    persist();
    notify();
}

export function subscribeDiagnostics(listener: () => void): () => void {
    hydrate();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
