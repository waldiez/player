/**
 * WID (Waldiez/SYNAPSE Identifier) generation and validation.
 * Format: YYYYMMDDTHHMMSS[mmm].<seqW>Z[-<scope>][-<padZ>]
 *
 * Copied from /Users/laztoum/Projects/waldiez/wid/typescript/src/wid.ts
 */
import { type TimeUnit, timeDigits } from "./time";

/** Parsed WID components after a successful parse. */
export interface ParsedWid {
    /** Raw identifier string that was parsed. */
    raw: string;
    /** UTC timestamp extracted from the WID envelope. */
    timestamp: Date;
    /** Sequential component embedded in the identifier. */
    sequence: number;
    /** Optional scope suffix if one was provided. */
    scope: string | null;
    /** Optional padding hex string when Z > 0. */
    padding: string | null;
}

/** In-memory snapshot of the last seen second/sequence for a generator. */
export interface WidStateSnapshot {
    lastSec: number;
    lastSeq: number;
}

/** Storage contract consumed by `WidGen` when persistence is enabled. */
export interface WidStateStore {
    load(key: string): WidStateSnapshot | null;
    save(key: string, state: WidStateSnapshot): void;
}

/** Basic in-memory store that keeps Wid state during runtime. */
export class MemoryWidStateStore implements WidStateStore {
    private readonly memory = new Map<string, WidStateSnapshot>();

    load(key: string): WidStateSnapshot | null {
        const hit = this.memory.get(key);
        return hit ? { ...hit } : null;
    }

    save(key: string, state: WidStateSnapshot): void {
        this.memory.set(key, { ...state });
    }
}

/** Browser localStorage-backed store; falls back to no-op outside browsers. */
class BrowserLocalStorageWidStateStore implements WidStateStore {
    private readonly prefix: string;

    constructor(prefix = "wid") {
        this.prefix = prefix;
    }

    private keyOf(key: string): string {
        return `${this.prefix}:${key}`;
    }

    private localStorageLike(): {
        getItem: (k: string) => string | null;
        setItem: (k: string, v: string) => void;
    } | null {
        const g = globalThis as unknown as Record<string, unknown>;
        const ls = g.localStorage as
            | { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }
            | undefined;
        return ls ?? null;
    }

    load(key: string): WidStateSnapshot | null {
        const ls = this.localStorageLike();
        if (!ls) return null;
        const raw = ls.getItem(this.keyOf(key));
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Partial<WidStateSnapshot>;
            if (
                typeof parsed.lastSec === "number" &&
                Number.isFinite(parsed.lastSec) &&
                typeof parsed.lastSeq === "number" &&
                Number.isFinite(parsed.lastSeq)
            ) {
                return { lastSec: parsed.lastSec, lastSeq: parsed.lastSeq };
            }
        } catch {
            return null;
        }
        return null;
    }

    save(key: string, state: WidStateSnapshot): void {
        const ls = this.localStorageLike();
        if (!ls) return;
        ls.setItem(this.keyOf(key), JSON.stringify(state));
    }
}

/**
 * Creates a browser localStorage-backed state store.
 * In non-browser runtimes this behaves as a no-op store.
 */
export function createBrowserWidStateStore(prefix = "wid"): WidStateStore {
    return new BrowserLocalStorageWidStateStore(prefix);
}

/** SQLite-backed store for Node environments that support `node:sqlite`. */
class NodeSqliteWidStateStore implements WidStateStore {
    private readonly db: {
        exec: (sql: string) => void;
        prepare: (sql: string) => {
            get: (...args: unknown[]) => unknown;
            run: (...args: unknown[]) => unknown;
        };
        close?: () => void;
    };
    private readonly prefix: string;

    constructor(databasePath: string, prefix = "wid") {
        this.prefix = prefix;
        const DatabaseSync = resolveNodeSqliteDatabaseSync();
        this.db = new DatabaseSync(databasePath);
        this.db.exec(
            "CREATE TABLE IF NOT EXISTS wid_state (k TEXT PRIMARY KEY, last_sec INTEGER NOT NULL, last_seq INTEGER NOT NULL)",
        );
    }

    private fullKey(key: string): string {
        return `${this.prefix}:${key}`;
    }

    load(key: string): WidStateSnapshot | null {
        const row = this.db
            .prepare("SELECT last_sec, last_seq FROM wid_state WHERE k = ?")
            .get(this.fullKey(key)) as { last_sec?: number; last_seq?: number } | undefined;
        if (!row) return null;
        if (typeof row.last_sec !== "number" || typeof row.last_seq !== "number") return null;
        return { lastSec: row.last_sec, lastSeq: row.last_seq };
    }

    save(key: string, state: WidStateSnapshot): void {
        this.db
            .prepare(
                "INSERT INTO wid_state (k, last_sec, last_seq) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET last_sec=excluded.last_sec, last_seq=excluded.last_seq",
            )
            .run(this.fullKey(key), state.lastSec, state.lastSeq);
    }

    close(): void {
        this.db.close?.();
    }
}

function resolveNodeSqliteDatabaseSync(): new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => { get: (...args: unknown[]) => unknown; run: (...args: unknown[]) => unknown };
    close?: () => void;
} {
    const proc = (globalThis as { process?: unknown }).process as
        | { versions?: { node?: string }; getBuiltinModule?: (name: string) => unknown }
        | undefined;
    if (!proc?.versions?.node) {
        throw new Error("SQLite state store requires Node.js");
    }

    const builtin = typeof proc.getBuiltinModule === "function" ? proc.getBuiltinModule("node:sqlite") : null;
    if (builtin && typeof builtin === "object" && "DatabaseSync" in builtin) {
        return (builtin as { DatabaseSync: new (path: string) => NodeSqliteWidStateStore["db"] })
            .DatabaseSync;
    }

    throw new Error("node:sqlite unavailable in this Node runtime");
}

/** Node factory that requires the `node:sqlite` module for persistence. */
export function createNodeSqliteWidStateStore(databasePath: string, prefix = "wid"): WidStateStore {
    return new NodeSqliteWidStateStore(databasePath, prefix);
}

/** Configuration options accepted by `WidGen`. */
export interface WidGenOptions {
    /** Width of the sequence segment (default 4). */
    W?: number;
    /** Padding length (default 6). */
    Z?: number;
    /** Optional scope suffix appended to generated IDs. */
    scope?: string;
    /** Time unit precision, either `sec` or `ms`. */
    timeUnit?: TimeUnit;
    /** Optional persistence layer for generator state. */
    stateStore?: WidStateStore;
    /** Key used when storing state. */
    stateKey?: string;
    /** Persist state after each generation when true. */
    autoPersist?: boolean;
}

/** Extended configuration for streaming helpers around `WidGen`. */
export interface AsyncWidStreamOptions extends WidGenOptions {
    /** Number of IDs to emit (0 for infinite). */
    count?: number;
    /** Delay between emits in milliseconds. */
    intervalMs?: number;
}

/** Cache of regex instances for base WID formats per width/unit. */
const WID_BASE_RE_CACHE = new Map<string, RegExp>();
/** Cache for padding-hex validation patterns keyed by width. */
const HEX_RE_CACHE = new Map<number, RegExp>();
/** Scope suffix pattern accepted by all generators. */
const SCOPE_PATTERN = /^[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*$/;

function widBaseRe(W: number, unit: TimeUnit): RegExp {
    const key = `${W}:${unit}`;
    const cached = WID_BASE_RE_CACHE.get(key);
    if (cached) return cached;
    const re = new RegExp(`^(\\d{8})T(\\d{${timeDigits(unit)}})\\.(\\d{${W}})Z(.*)?$`);
    WID_BASE_RE_CACHE.set(key, re);
    return re;
}

function hexRe(Z: number): RegExp {
    const cached = HEX_RE_CACHE.get(Z);
    if (cached) return cached;
    const re = new RegExp(`^[0-9a-f]{${Z}}$`);
    HEX_RE_CACHE.set(Z, re);
    return re;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function randomHexChars(Z: number): string {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error("Secure random generator unavailable in this runtime");
    }
    const bytes = new Uint8Array(Math.ceil(Z / 2));
    globalThis.crypto.getRandomValues(bytes);
    return bytesToHex(bytes).slice(0, Z);
}

function parseSuffix(suffix: string, Z: number): { scope: string | null; padding: string | null } | null {
    if (!suffix) {
        return { scope: null, padding: null };
    }

    if (!suffix.startsWith("-")) {
        return null;
    }

    const body = suffix.slice(1);
    if (!body) {
        return null;
    }

    let scope: string | null = null;
    let padding: string | null = null;

    if (Z > 0) {
        const splitAt = body.lastIndexOf("-");
        if (splitAt >= 0) {
            const maybeScope = body.slice(0, splitAt);
            const maybePadding = body.slice(splitAt + 1);
            if (hexRe(Z).test(maybePadding)) {
                padding = maybePadding;
                scope = maybeScope || null;
            } else if (maybePadding.length === Z && /^[0-9A-Fa-f]+$/.test(maybePadding)) {
                return null;
            } else {
                scope = body;
            }
        } else if (hexRe(Z).test(body)) {
            padding = body;
        } else if (body.length === Z && /^[0-9A-Fa-f]+$/.test(body)) {
            return null;
        } else {
            scope = body;
        }
    } else {
        scope = body;
    }

    if (scope !== null && !SCOPE_PATTERN.test(scope)) {
        return null;
    }

    if (padding !== null && !hexRe(Z).test(padding)) {
        return null;
    }

    return { scope, padding };
}

function parseTimestamp(dateStr: string, timeStr: string, timeUnit: TimeUnit): Date | null {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10);
    const day = parseInt(dateStr.slice(6, 8), 10);
    const hour = parseInt(timeStr.slice(0, 2), 10);
    const minute = parseInt(timeStr.slice(2, 4), 10);
    const second = parseInt(timeStr.slice(4, 6), 10);
    const millis = timeUnit === "ms" ? parseInt(timeStr.slice(6, 9), 10) : 0;

    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (hour > 23 || minute > 59 || second > 59) return null;
    if (millis < 0 || millis > 999) return null;

    const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millis));
    if (isNaN(timestamp.getTime())) return null;
    if (timestamp.getUTCDate() !== day || timestamp.getUTCMonth() + 1 !== month) return null;
    return timestamp;
}

function parseCore(wid: string, W: number, Z: number, timeUnit: TimeUnit): ParsedWid | null {
    if (W <= 0 || Z < 0) return null;

    const match = widBaseRe(W, timeUnit).exec(wid);
    if (!match) return null;

    const [, dateStr, timeStr, seqStr, suffixRaw] = match;
    const suffix = suffixRaw ?? "";

    const timestamp = parseTimestamp(dateStr, timeStr, timeUnit);
    if (!timestamp) return null;

    const parsedSuffix = parseSuffix(suffix, Z);
    if (!parsedSuffix) return null;

    return {
        raw: wid,
        timestamp,
        sequence: parseInt(seqStr, 10),
        scope: parsedSuffix.scope,
        padding: parsedSuffix.padding,
    };
}

export function validateWid(wid: string, W = 4, Z = 6, timeUnit: TimeUnit = "sec"): boolean {
    return parseCore(wid, W, Z, timeUnit) !== null;
}

export function parseWid(wid: string, W = 4, Z = 6, timeUnit: TimeUnit = "sec"): ParsedWid | null {
    return parseCore(wid, W, Z, timeUnit);
}

export async function asyncNextWid(options: WidGenOptions = {}): Promise<string> {
    return new WidGen(options).next();
}

export async function* asyncWidStream(options: AsyncWidStreamOptions = {}): AsyncGenerator<string> {
    const { count = 0, intervalMs = 0, ...genOpts } = options;
    if (count < 0) throw new Error("count must be >= 0");
    if (intervalMs < 0) throw new Error("intervalMs must be >= 0");

    const gen = new WidGen(genOpts);
    let emitted = 0;
    while (count === 0 || emitted < count) {
        yield gen.next();
        emitted += 1;
        if (intervalMs > 0) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }
}

/** Stateful generator for WID IDs that keeps monotonicity guarantees. */
export class WidGen {
    private readonly W: number;
    private readonly Z: number;
    private readonly scope: string | null;
    private readonly timeUnit: TimeUnit;
    private readonly maxSeq: number;
    private readonly stateStore: WidStateStore | null;
    private readonly stateKey: string;
    private readonly autoPersist: boolean;

    private lastSec = 0;
    private lastSeq = -1;
    private cachedSec = -1;
    private cachedTs = "";

    /** Create a generator with optional persistence and precision control. */
    constructor(options: WidGenOptions = {}) {
        const {
            W = 4,
            Z = 6,
            scope,
            timeUnit = "sec",
            stateStore,
            stateKey = "wid",
            autoPersist = false,
        } = options;

        if (W <= 0) throw new Error("W must be > 0");
        if (Z < 0) throw new Error("Z must be >= 0");
        if (scope && !SCOPE_PATTERN.test(scope)) {
            throw new Error("Invalid scope format");
        }

        this.W = W;
        this.Z = Z;
        this.scope = scope ?? null;
        this.timeUnit = timeUnit;
        this.maxSeq = Math.pow(10, W) - 1;
        this.stateStore = stateStore ?? null;
        this.stateKey = stateKey;
        this.autoPersist = autoPersist;

        if (this.autoPersist && this.stateStore) {
            const loaded = this.stateStore.load(this.stateKey);
            if (
                loaded &&
                Number.isFinite(loaded.lastSec) &&
                Number.isFinite(loaded.lastSeq) &&
                loaded.lastSec >= 0 &&
                loaded.lastSeq >= -1
            ) {
                this.lastSec = loaded.lastSec;
                this.lastSeq = loaded.lastSeq;
            }
        }
    }

    private persistState(): void {
        if (!this.autoPersist || !this.stateStore) return;
        try {
            this.stateStore.save(this.stateKey, { lastSec: this.lastSec, lastSeq: this.lastSeq });
        } catch {
            // Keep generator functional even if persistence fails.
        }
    }

    private tsForTick(tick: number): string {
        if (tick !== this.cachedSec) {
            this.cachedSec = tick;
            const sec = this.timeUnit === "ms" ? Math.floor(tick / 1000) : tick;
            const ms = this.timeUnit === "ms" ? tick % 1000 : 0;
            const d = new Date(sec * 1000);
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, "0");
            const day = String(d.getUTCDate()).padStart(2, "0");
            const hour = String(d.getUTCHours()).padStart(2, "0");
            const minute = String(d.getUTCMinutes()).padStart(2, "0");
            const second = String(d.getUTCSeconds()).padStart(2, "0");
            const milli = String(ms).padStart(3, "0");
            this.cachedTs =
                this.timeUnit === "ms"
                    ? `${year}${month}${day}T${hour}${minute}${second}${milli}`
                    : `${year}${month}${day}T${hour}${minute}${second}`;
        }
        return this.cachedTs;
    }

    private nowTick(): number {
        if (this.timeUnit === "ms") {
            return Date.now();
        }
        return Math.floor(Date.now() / 1000);
    }

    next(): string {
        const now = this.nowTick();
        let tick = now > this.lastSec ? now : this.lastSec;
        let seq = tick === this.lastSec ? this.lastSeq + 1 : 0;

        if (seq > this.maxSeq) {
            tick += 1;
            seq = 0;
        }

        this.lastSec = tick;
        this.lastSeq = seq;

        const ts = this.tsForTick(tick);
        const seqStr = String(seq).padStart(this.W, "0");
        let wid = `${ts}.${seqStr}Z`;

        if (this.scope) {
            wid += `-${this.scope}`;
        }

        if (this.Z > 0) {
            wid += `-${randomHexChars(this.Z)}`;
        }

        this.persistState();
        return wid;
    }

    nextN(n: number): string[] {
        return Array.from({ length: n }, () => this.next());
    }

    get state(): WidStateSnapshot {
        return { lastSec: this.lastSec, lastSeq: this.lastSeq };
    }

    restoreState(lastSec: number, lastSeq: number): void {
        this.lastSec = lastSec;
        this.lastSeq = lastSeq;
        this.persistState();
    }
}
