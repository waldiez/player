/**
 * moodDefaults — wideria-prefs persistence helpers.
 *
 * Mirrors the storage format used by kideria/web/player.js so that playlists
 * saved in the kideria player are shared with this React player.
 *
 * Storage key:  "wideria-prefs"
 * Schema v2:    { v:2, mode, volume, muted, loop, shuffle, eq, fx,
 *                 modes: { [mode]: { ytTracks, savedTrackId } },
 *                 modeDefaults: { [mode]: [...ytTracks] } }
 */
import type { MediaFile } from "@/types";
import { MOOD_META, MOOD_MODES } from "@/types/mood";
import type { AudioChainConfig, MoodMode } from "@/types/mood";
import YAML from "yaml";

import { parseMediaUrl } from "./mediaSource";
import { nextWid } from "./wid";

// ── Storage key (matches kideria/web/player.js PREFS_KEY) ─────────────────
export const PREFS_KEY = "wideria-prefs";

// ── User-customizable mood appearance ─────────────────────────────────────
export interface MoodCustomization {
    label?: string;
    accent?: string;
    bg?: string;
}

// ── Storage size guard ─────────────────────────────────────────────────────
// Target: keep wideria-prefs under ~2.5 MB (half of the typical 5 MB quota).
const STORAGE_BUDGET = 2.5 * 1024 * 1024; // bytes

function estimateStorageSize(): number {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) ?? "";
        bytes += (key.length + (localStorage.getItem(key) ?? "").length) * 2; // UTF-16
    }
    return bytes;
}

/**
 * Serialise `prefs` and write to localStorage only if the result fits within
 * the budget.  Returns true on success.
 */
function safeWritePrefs(prefs: object): boolean {
    const data = JSON.stringify(prefs);
    const newBytes = data.length * 2;
    const currentBytes = (localStorage.getItem(PREFS_KEY) ?? "").length * 2;
    const otherBytes = estimateStorageSize() - currentBytes;

    if (otherBytes + newBytes > STORAGE_BUDGET) {
        console.warn("[moodDefaults] localStorage budget (~2.5 MB) would be exceeded — save skipped.");
        return false;
    }
    try {
        localStorage.setItem(PREFS_KEY, data);
        return true;
    } catch {
        return false;
    }
}

// ── Hardcoded default playlists per mood mode ─────────────────────────────
// Mirrors kideria's MODE_DEFAULTS — used when the user has no saved playlist.
const HARDCODED_DEFAULTS: Record<MoodMode, { videoId: string; name: string }[]> = {
    journey: [
        { videoId: "7hHZnvjCbVw", name: "Habits — Vintage 1930's Jazz (Haley Reinhart)" },
        { videoId: "I03xFqbxUp8", name: "YouTube · I03xFqbxUp8" },
        { videoId: "m3lF2qEA2cw", name: "YouTube · m3lF2qEA2cw" },
    ],
    dock: [{ videoId: "TdrL3QxjyVw", name: "YouTube · TdrL3QxjyVw" }],
    storm: [{ videoId: "2tOutF8B3f8", name: "YouTube · 2tOutF8B3f8" }],
    fest: [
        { videoId: "4xiWvdwsCBQ", name: "YouTube · 4xiWvdwsCBQ" },
        { videoId: "dZNekHrcMPc", name: "YouTube · dZNekHrcMPc" },
        { videoId: "0vfTiV0BCSw", name: "YouTube · 0vfTiV0BCSw" },
        { videoId: "2tOutF8B3f8", name: "YouTube · 2tOutF8B3f8" },
    ],
    rock: [
        { videoId: "hTWKbfoikeg", name: "YouTube · hTWKbfoikeg" },
        { videoId: "btPJPFnesV4", name: "YouTube · btPJPFnesV4" },
    ],
    pop: [
        { videoId: "nfWlot6h_JM", name: "YouTube · nfWlot6h_JM" },
        { videoId: "RgKAFK5djSk", name: "YouTube · RgKAFK5djSk" },
    ],
    disco: [
        { videoId: "k7_0WorMSNE", name: "YouTube · k7_0WorMSNE" },
        { videoId: "TLV4_xaYynY", name: "YouTube · TLV4_xaYynY" },
    ],
};

// ── Internal types (kideria wire format) ──────────────────────────────────
interface WideriaTrack {
    type: "youtube";
    ytType: "video" | "playlist";
    videoId?: string;
    listId?: string;
    name: string;
    artist?: string;
    chapter?: null;
}

interface WideriaPrefs {
    v?: number;
    mode?: string;
    volume?: number;
    muted?: boolean;
    loop?: boolean;
    shuffle?: boolean;
    eq?: { bass: number; mid: number; treble: number };
    fx?: { reverb: boolean; echo: boolean; fuzz: boolean; vinyl: boolean };
    modes?: Record<
        string,
        {
            ytTracks: WideriaTrack[];
            savedTrackId?: string | null;
            savedTime?: number;
            eq?: { bass: number; mid: number; treble: number };
            fx?: { reverb: boolean; echo: boolean; fuzz: boolean; vinyl: boolean };
        }
    >;
    modeDefaults?: Record<string, WideriaTrack[]>;
    moodCustomizations?: Partial<Record<string, MoodCustomization>>;
    syncDefaultsFromLatest?: boolean;
    // v1 legacy fields (top-level)
    ytTracks?: WideriaTrack[];
    savedTrackId?: string | null;
}

// ── Read / write prefs ────────────────────────────────────────────────────

export function readPrefs(): WideriaPrefs | null {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        return raw ? (JSON.parse(raw) as WideriaPrefs) : null;
    } catch {
        return null;
    }
}

export function getSyncDefaultsFromLatest(): boolean {
    return readPrefs()?.syncDefaultsFromLatest === true;
}

export function setSyncDefaultsFromLatest(enabled: boolean): boolean {
    const existing = (readPrefs() ?? {}) as Record<string, unknown>;
    return safeWritePrefs({
        ...existing,
        syncDefaultsFromLatest: enabled,
        v: typeof existing.v === "number" ? existing.v : 2,
    });
}

export async function bootstrapDefaultPrefsFromAsset(): Promise<boolean> {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
    const existing = readPrefs();
    const shouldSync = !existing || existing.syncDefaultsFromLatest === true;
    if (!shouldSync) return false;

    function applyState(state: Record<string, unknown>): boolean {
        const keepSyncEnabled = existing?.syncDefaultsFromLatest === true;
        return safeWritePrefs({
            ...state,
            syncDefaultsFromLatest: keepSyncEnabled || state.syncDefaultsFromLatest === true,
        });
    }

    // ?w= lets the host (or a link) override the default preset URL.
    const customUrl = new URLSearchParams(window.location.search).get("w") ?? null;

    async function tryWid(url: string): Promise<boolean> {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return false;
        const text = await res.text();
        const parsed = YAML.parse(text) as unknown;
        const state = parseMaybeManifest(parsed);
        return state ? applyState(state) : false;
    }

    async function tryWaldiez(url: string): Promise<boolean> {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return false;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const manifestBytes = readZipEntry(bytes, "MANIFEST");
        if (!manifestBytes) return false;
        const text = new TextDecoder().decode(manifestBytes);
        const parsed = YAML.parse(text) as unknown;
        const state = parseMaybeManifest(parsed);
        return state ? applyState(state) : false;
    }

    try {
        // Custom URL from ?w= — try as-is first (wid/YAML), then as waldiez (zip).
        if (customUrl) {
            if (await tryWid(customUrl)) return true;
            if (await tryWaldiez(customUrl)) return true;
        }
        // Built-in defaults — use BASE_URL so GitHub Pages (/player/) is handled correctly.
        const base = import.meta.env.BASE_URL ?? "/";
        if (await tryWid(`${base}default.wid`)) return true;
        return await tryWaldiez(`${base}default.waldiez`);
    } catch {
        return false;
    }
}

// ── Format conversion ─────────────────────────────────────────────────────

function ytTrackToMediaFile(t: WideriaTrack): MediaFile | null {
    const videoId = t.videoId;
    if (!videoId) return null;
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const parsed = parseMediaUrl(ytUrl);
    if (!parsed) return null;
    return {
        id: nextWid(),
        name: t.name && !t.name.startsWith("Loading") ? t.name : `YouTube · ${videoId}`,
        path: parsed.path,
        type: "video",
        source: "youtube",
        embedUrl: parsed.embedUrl,
        youtubeId: videoId,
        duration: 0,
        size: 0,
        createdAt: new Date(),
    };
}

export function mediaFileToWideriaTrack(file: MediaFile): WideriaTrack | null {
    if (file.source !== "youtube" || !file.youtubeId) return null;
    return {
        type: "youtube",
        ytType: "video",
        videoId: file.youtubeId,
        name: file.name,
        artist: "YouTube",
        chapter: null,
    };
}

// ── Playlist resolution (priority order) ─────────────────────────────────

/** Returns saved session tracks for `mode` (v1/v2 compatible), or null. */
function getSavedSessionTracks(
    mode: MoodMode,
    prefs: WideriaPrefs,
): { files: MediaFile[]; currentId?: string; currentTime?: number } | null {
    const modeData =
        prefs.modes?.[mode] ??
        // v1 legacy: top-level ytTracks only if the saved mode matches
        (prefs.mode === mode && prefs.ytTracks?.length
            ? { ytTracks: prefs.ytTracks, savedTrackId: prefs.savedTrackId }
            : null);

    if (!modeData?.ytTracks?.length) return null;

    const files = modeData.ytTracks.map(ytTrackToMediaFile).filter((f): f is MediaFile => f !== null);
    if (!files.length) return null;

    return {
        files,
        currentId: modeData.savedTrackId ?? undefined,
        currentTime: modeData.savedTime ?? undefined,
    };
}

/** Returns user-saved defaults for `mode` (via "Save as default"), or null. */
function getUserDefaultTracks(mode: MoodMode, prefs: WideriaPrefs): MediaFile[] | null {
    const defs = prefs.modeDefaults?.[mode];
    if (!defs?.length) return null;
    const files = defs.map(ytTrackToMediaFile).filter((f): f is MediaFile => f !== null);
    return files.length ? files : null;
}

/**
 * Load the best available tracklist for `mode`:
 *   1. Last-saved session tracks (prefs.modes[mode])
 *   2. User-saved defaults      (prefs.modeDefaults[mode])
 *   3. Hardcoded defaults       (HARDCODED_DEFAULTS[mode])
 */
export function loadModeTracklist(mode: MoodMode): {
    files: MediaFile[];
    currentId?: string;
    currentTime?: number;
} {
    const prefs = readPrefs();

    if (prefs) {
        const session = getSavedSessionTracks(mode, prefs);
        if (session) return session;

        const userDefs = getUserDefaultTracks(mode, prefs);
        if (userDefs) return { files: userDefs };
    }

    const files = (HARDCODED_DEFAULTS[mode] ?? [])
        .map(({ videoId, name }) => ytTrackToMediaFile({ type: "youtube", ytType: "video", videoId, name }))
        .filter((f): f is MediaFile => f !== null);

    return { files };
}

// ── Persist helpers ───────────────────────────────────────────────────────

/**
 * Save the current mode's tracklist to wideria-prefs.
 * Non-destructive: preserves other modes' data and modeDefaults.
 * Optionally also updates top-level mode, volume, muted fields.
 */
export function saveModeTracksToPrefs(
    mode: MoodMode,
    files: MediaFile[],
    currentFile: MediaFile | null,
    appState?: { volume?: number; muted?: boolean; t?: number },
): void {
    const ytTracks = files.map(mediaFileToWideriaTrack).filter((t): t is WideriaTrack => t !== null);

    const savedTrackId = currentFile?.youtubeId ?? null;

    const existing = readPrefs() ?? {};
    const modes = Object.assign({}, existing.modes);
    // Preserve existing eq/fx for the mode entry when updating tracks
    const existingModeEntry = modes[mode] ?? {};
    const savedTime =
        appState?.t !== undefined && appState.t > 0 ? Math.round(appState.t) : existingModeEntry.savedTime;
    modes[mode] = {
        ytTracks,
        savedTrackId,
        savedTime,
        eq: existingModeEntry.eq,
        fx: existingModeEntry.fx,
    };

    const topLevel: Partial<WideriaPrefs> = { mode };
    if (appState?.volume !== undefined) topLevel.volume = appState.volume;
    if (appState?.muted !== undefined) topLevel.muted = appState.muted;

    safeWritePrefs(Object.assign({}, existing, topLevel, { modes, v: 2 }));
}

/**
 * Save EQ + FX settings for the given mode to wideria-prefs.
 * Stored inside prefs.modes[mode].eq / .fx.
 */
export function saveModeEqFxToPrefs(
    mode: MoodMode,
    eq: AudioChainConfig["eq"],
    fx: AudioChainConfig["fx"],
): void {
    const existing = readPrefs() ?? {};
    const modes = Object.assign({}, existing.modes);
    const existingModeEntry = modes[mode] ?? { ytTracks: [] };
    modes[mode] = { ...existingModeEntry, eq, fx };
    safeWritePrefs(Object.assign({}, existing, { modes, v: 2 }));
}

/**
 * Load saved EQ + FX for `mode` from wideria-prefs.
 * Returns null when no saved data exists (caller should use MOOD_META defaults).
 */
export function loadModeEqFx(mode: MoodMode): AudioChainConfig | null {
    const prefs = readPrefs();
    if (!prefs?.modes?.[mode]) return null;
    const { eq, fx } = prefs.modes[mode];
    if (!eq || !fx) return null;
    return { eq, fx };
}

/**
 * Load the last-saved active mode from wideria-prefs.
 * Returns null when nothing was saved yet.
 */
export function loadSavedMode(): MoodMode | null {
    const prefs = readPrefs();
    const saved = prefs?.mode;
    if (!saved) return null;
    return (MOOD_MODES as readonly string[]).includes(saved) ? (saved as MoodMode) : null;
}

/**
 * Save the current playlist as the user-defined default for `mode`.
 * Only YouTube tracks are saved (local blob URLs are session-only).
 */
export function saveDefaultForMode(mode: MoodMode, files: MediaFile[]): void {
    const ytTracks = files.map(mediaFileToWideriaTrack).filter((t): t is WideriaTrack => t !== null);

    if (!ytTracks.length) return;

    const existing = readPrefs() ?? {};
    const modeDefaults = Object.assign({}, existing.modeDefaults);
    modeDefaults[mode] = ytTracks;
    safeWritePrefs(Object.assign({}, existing, { modeDefaults, v: 2 }));
}

// ── Mood customization CRUD ───────────────────────────────────────────────

/** Returns all stored mood customizations (merged over defaults). */
export function loadMoodCustomizations(): Partial<Record<MoodMode, MoodCustomization>> {
    return (readPrefs()?.moodCustomizations ?? {}) as Partial<Record<MoodMode, MoodCustomization>>;
}

/**
 * Persist a user customization for `mode`.
 * Only stores fields that differ from the MOOD_META defaults (keeps the record small).
 */
export function saveMoodCustomization(mode: MoodMode, custom: MoodCustomization): void {
    const defaults = MOOD_META[mode];
    const delta: MoodCustomization = {};
    if (custom.label && custom.label !== defaults.label) delta.label = custom.label;
    if (custom.accent && custom.accent !== defaults.accent) delta.accent = custom.accent;
    if (custom.bg && custom.bg !== defaults.bg) delta.bg = custom.bg;

    const existing = readPrefs() ?? {};
    const moodCustomizations = Object.assign({}, existing.moodCustomizations);
    moodCustomizations[mode] = Object.keys(delta).length ? delta : undefined;
    safeWritePrefs(Object.assign({}, existing, { moodCustomizations, v: 2 }));
}

/** Remove the user customization for `mode`, reverting to MOOD_META defaults. */
export function resetMoodCustomization(mode: MoodMode): void {
    const existing = readPrefs() ?? {};
    const moodCustomizations = Object.assign({}, existing.moodCustomizations);
    delete moodCustomizations[mode];
    safeWritePrefs(Object.assign({}, existing, { moodCustomizations, v: 2 }));
}

// ── Export / Import preferences (.wid/.waldiez, manifest-compatible) ─────

const MANIFEST_SCHEMA = "https://xperiens.waldiez.io/schema/v1/manifest";

const CAPABILITIES = [
    "waldiez.player.export.wid.v1",
    "waldiez.player.export.waldiez.v1",
    "waldiez.player.state.preferences.v1",
] as const;

interface PreferencesManifest {
    $schema: string;
    identity: {
        wid: string;
        type: string;
        created: string;
    };
    description: {
        name: string;
        purpose: string;
        tags: string[];
    };
    interface: {
        capabilities: string[];
        capability_ids: Record<string, string>;
        operations: Array<Record<string, unknown>>;
        state_schema: Record<string, unknown>;
    };
    state: Record<string, unknown>;
    execution: Record<string, unknown>;
    lifecycle: Record<string, unknown>;
}

function countSkippedLocalFiles(mediaLibrary?: MediaFile[]): number {
    return mediaLibrary?.filter(f => !f.source || f.path.startsWith("blob:")).length ?? 0;
}

function buildCapabilityIds(): Record<string, string> {
    return Object.fromEntries(CAPABILITIES.map(cap => [cap, `wdz://waldiez/player/capability/${nextWid()}`]));
}

function buildPreferencesManifest(state: Record<string, unknown>, created: string): PreferencesManifest {
    return {
        $schema: MANIFEST_SCHEMA,
        identity: {
            wid: `wdz://waldiez/player/preferences/${nextWid()}`,
            type: "state",
            created,
        },
        description: {
            name: "Waldiez Player Preferences",
            purpose: "Portable preferences snapshot for the web player.",
            tags: ["waldiez", "player", "preferences", "export"],
        },
        interface: {
            capabilities: [...CAPABILITIES],
            capability_ids: buildCapabilityIds(),
            operations: [
                {
                    name: "import-preferences",
                    description: "Apply exported preferences state to local player settings.",
                    params: {},
                    returns: { type: "boolean" },
                },
            ],
            state_schema: {
                mode: { type: "string", mutable: true },
                volume: { type: "number", mutable: true },
                muted: { type: "boolean", mutable: true },
                modes: { type: "object", mutable: true },
                modeDefaults: { type: "object", mutable: true },
                moodCustomizations: { type: "object", mutable: true },
            },
        },
        state,
        execution: {
            runtime: "wdz://runtimes/browser",
            protocol: "wdz://protocols/local-storage-v1",
        },
        lifecycle: {
            exported_at: created,
        },
    };
}

function triggerDownload(content: BlobPart | Uint8Array, filename: string, mimeType: string): void {
    const blobPart = content instanceof Uint8Array ? new Uint8Array(content) : content;
    const blob = new Blob([blobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function makeCrcTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c >>> 0;
    }
    return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function writeU16(out: number[], value: number): void {
    out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number): void {
    out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function encodeUtf8(input: string): Uint8Array {
    return new TextEncoder().encode(input);
}

function createZipStore(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
    const out: number[] = [];
    const central: number[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encodeUtf8(entry.name);
        const data = entry.data;
        const checksum = crc32(data);

        writeU32(out, 0x04034b50);
        writeU16(out, 20);
        writeU16(out, 0);
        writeU16(out, 0);
        writeU16(out, 0);
        writeU16(out, 0);
        writeU32(out, checksum);
        writeU32(out, data.length);
        writeU32(out, data.length);
        writeU16(out, nameBytes.length);
        writeU16(out, 0);
        out.push(...nameBytes, ...data);

        writeU32(central, 0x02014b50);
        writeU16(central, 20);
        writeU16(central, 20);
        writeU16(central, 0);
        writeU16(central, 0);
        writeU16(central, 0);
        writeU16(central, 0);
        writeU32(central, checksum);
        writeU32(central, data.length);
        writeU32(central, data.length);
        writeU16(central, nameBytes.length);
        writeU16(central, 0);
        writeU16(central, 0);
        writeU16(central, 0);
        writeU16(central, 0);
        writeU32(central, 0);
        writeU32(central, offset);
        central.push(...nameBytes);

        offset = out.length;
    }

    const centralOffset = out.length;
    out.push(...central);
    const centralSize = out.length - centralOffset;

    writeU32(out, 0x06054b50);
    writeU16(out, 0);
    writeU16(out, 0);
    writeU16(out, entries.length);
    writeU16(out, entries.length);
    writeU32(out, centralSize);
    writeU32(out, centralOffset);
    writeU16(out, 0);

    return new Uint8Array(out);
}

function parseMaybeManifest(obj: unknown): Record<string, unknown> | null {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const root = obj as Record<string, unknown>;
    if (
        typeof root.$schema === "string" &&
        root.$schema.includes("/manifest") &&
        root.state &&
        typeof root.state === "object" &&
        !Array.isArray(root.state)
    ) {
        return root.state as Record<string, unknown>;
    }
    if (
        typeof root.$schema === "string" &&
        root.$schema.includes("/wid") &&
        root.state &&
        typeof root.state === "object" &&
        !Array.isArray(root.state)
    ) {
        return root.state as Record<string, unknown>;
    }
    return root;
}

function readZipEntry(bytes: Uint8Array, entryName: string): Uint8Array | null {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 4; i++) {
        if (dv.getUint32(i, true) !== 0x06054b50) continue;
        const centralOffset = dv.getUint32(i + 16, true);
        const totalEntries = dv.getUint16(i + 10, true);
        let p = centralOffset;
        for (let n = 0; n < totalEntries; n++) {
            if (dv.getUint32(p, true) !== 0x02014b50) return null;
            const method = dv.getUint16(p + 10, true);
            const compSize = dv.getUint32(p + 20, true);
            const nameLen = dv.getUint16(p + 28, true);
            const extraLen = dv.getUint16(p + 30, true);
            const commentLen = dv.getUint16(p + 32, true);
            const localOffset = dv.getUint32(p + 42, true);
            const nameBytes = bytes.slice(p + 46, p + 46 + nameLen);
            const name = new TextDecoder().decode(nameBytes);

            if (name === entryName) {
                if (method !== 0) return null; // stored-only parser
                if (dv.getUint32(localOffset, true) !== 0x04034b50) return null;
                const localNameLen = dv.getUint16(localOffset + 26, true);
                const localExtraLen = dv.getUint16(localOffset + 28, true);
                const dataStart = localOffset + 30 + localNameLen + localExtraLen;
                return bytes.slice(dataStart, dataStart + compSize);
            }

            p += 46 + nameLen + extraLen + commentLen;
        }
    }
    return null;
}

export function exportPrefsAsWid(mediaLibrary?: MediaFile[]): { skippedLocalFiles: number } {
    const state = (readPrefs() ?? {}) as Record<string, unknown>;
    const created = new Date().toISOString();
    const manifest = buildPreferencesManifest(state, created);
    const content = YAML.stringify(manifest);
    const date = created.slice(0, 10);
    const skippedLocalFiles = countSkippedLocalFiles(mediaLibrary);

    triggerDownload(content, `wideria-prefs-${date}.wid`, "application/yaml");
    return { skippedLocalFiles };
}

export function exportPrefsAsWaldiez(mediaLibrary?: MediaFile[]): { skippedLocalFiles: number } {
    const state = (readPrefs() ?? {}) as Record<string, unknown>;
    const created = new Date().toISOString();
    const manifest = buildPreferencesManifest(state, created);
    const manifestText = YAML.stringify(manifest);
    const date = created.slice(0, 10);
    const skippedLocalFiles = countSkippedLocalFiles(mediaLibrary);

    const zip = createZipStore([
        { name: ".tic", data: encodeUtf8(`${created}\n`) },
        { name: "MANIFEST", data: encodeUtf8(manifestText) },
        { name: "data/preferences.json", data: encodeUtf8(JSON.stringify(state, null, 2)) },
    ]);

    triggerDownload(zip, `wideria-prefs-${date}.waldiez`, "application/zip");
    return { skippedLocalFiles };
}

export async function importPrefsFromFile(file: File): Promise<boolean> {
    try {
        // Preferred: `.waldiez` zip archive with MANIFEST + .tic
        if (file.name.toLowerCase().endsWith(".waldiez")) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const manifestBytes = readZipEntry(bytes, "MANIFEST");
            if (manifestBytes) {
                const manifestText = new TextDecoder().decode(manifestBytes);
                const parsed = YAML.parse(manifestText) as unknown;
                const state = parseMaybeManifest(parsed);
                if (state) return safeWritePrefs(state);
            }
        }

        // `.wid` or legacy text formats (YAML or JSON)
        const text = await file.text();
        const parsed = YAML.parse(text) as unknown;
        const state = parseMaybeManifest(parsed);
        if (!state) {
            console.warn("[moodDefaults] import: expected object-like manifest or prefs payload");
            return false;
        }
        return safeWritePrefs(state);
    } catch (err) {
        console.warn("[moodDefaults] import failed:", err);
        return false;
    }
}

// ── YouTube title resolution ──────────────────────────────────────────────
// Resolves "YouTube · ID" placeholder names by querying the oEmbed API.

const _titleCache = new Map<string, string>();

export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
    if (_titleCache.has(videoId)) return _titleCache.get(videoId)!;
    try {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as { title?: string };
        const title = data.title ?? null;
        if (title) _titleCache.set(videoId, title);
        return title;
    } catch {
        return null;
    }
}
