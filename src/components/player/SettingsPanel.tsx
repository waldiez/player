/**
 * SettingsPanel — app settings, preset import/export, and beacon endpoint selection.
 */
import { SectionCard, ToggleRow, WeatherMoodSection } from "@/components/player/SettingsPanelWidgets";
import { type AddForm, emptyForm, useBeaconSettings } from "@/hooks/useBeaconSettings";
import { getDesktopStatus, refreshDesktopStatus, subscribeDesktopStatus } from "@/lib/desktopStatus";
import {
    exportPrefsAsWaldiez,
    exportPrefsAsWid,
    getSyncDefaultsFromLatest,
    importPrefsFromFile,
    importPrefsFromUrl,
    readPrefs,
    setSyncDefaultsFromLatest,
} from "@/lib/moodDefaults";
import { getRuntimeContext } from "@/lib/runtime";
import { STREAM_TARGETS, isBeaconCapableTarget } from "@/lib/streamTargets";
import { exportSupportSnapshot } from "@/lib/supportSnapshot";
import { type ScreensaverStyle, type UiSettings, readUiSettings, writeUiSettings } from "@/lib/uiSettings";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";
import type { PlayerMode } from "@/types";
import type { StreamProtocol } from "@/types/player";

import { useEffect, useRef, useState } from "react";

import {
    Download,
    ExternalLink,
    FileInput,
    HardDriveDownload,
    KeyRound,
    Link2,
    MonitorPlay,
    Plus,
    Radio,
    Settings,
    ShieldCheck,
    Trash2,
    Upload,
    X,
} from "lucide-react";

const BEACON_PROTOCOL_OPTIONS: StreamProtocol[] = ["ws", "wss", "mqtts"];

const PROTOCOL_BADGE: Record<StreamProtocol, string> = {
    ws: "bg-green-500/20 text-green-400",
    wss: "bg-blue-500/20 text-blue-400",
    mqtts: "bg-orange-500/20 text-orange-400",
    webrtc: "bg-purple-500/20 text-purple-400",
    rtsp: "bg-yellow-500/20 text-yellow-400",
    http: "bg-gray-500/20 text-gray-400",
    https: "bg-gray-500/20 text-gray-400",
};

const DESKTOP_STATUS_BADGE: Record<
    ReturnType<typeof getDesktopStatus>["overall"],
    { label: string; className: string }
> = {
    idle: { label: "Idle", className: "bg-gray-500/20 text-gray-300" },
    checking: { label: "Checking", className: "bg-sky-500/20 text-sky-300" },
    ready: { label: "Ready", className: "bg-emerald-500/20 text-emerald-300" },
    degraded: { label: "Degraded", className: "bg-amber-500/20 text-amber-300" },
    web: { label: "Web", className: "bg-slate-500/20 text-slate-300" },
};

const CAPABILITY_BADGE: Record<ReturnType<typeof getDesktopStatus>["backends"]["ytDlp"], string> = {
    ready: "bg-emerald-500/20 text-emerald-300",
    missing: "bg-amber-500/20 text-amber-300",
    error: "bg-red-500/20 text-red-300",
    unavailable: "bg-slate-500/20 text-slate-300",
};

interface SettingsPanelProps {
    onClose: () => void;
    className?: string;
    uiSettings?: UiSettings;
    onUiSettingsChange?: (s: UiSettings) => void;
}

type RemoteImportState = {
    value: string;
    loading: boolean;
    message: string | null;
    ok: boolean;
};

function normalizeGitHubUrl(url: string): string {
    if (url.startsWith("https://raw.githubusercontent.com/")) return url;
    if (!url.startsWith("https://github.com/")) return url;
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 5 && parts[2] === "blob") {
        const [owner, repo, , branch, ...rest] = parts;
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
    }
    return url;
}

function resolveRemoteImportCandidates(input: string): string[] {
    const trimmed = input.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return [normalizeGitHubUrl(trimmed)];
    }

    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length < 2) return [];

    const [owner, repo, ...rest] = parts;
    const branches = ["main", "master"];
    const paths =
        rest.length > 0
            ? [rest.join("/")]
            : [
                  "public/default.wid",
                  "public/default.waldiez",
                  "public/cdn/repo/latest-auto.wid",
                  "default.wid",
              ];

    return branches.flatMap(branch =>
        paths.map(path => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`),
    );
}

export function SettingsPanel({
    onClose,
    className,
    uiSettings: uiSettingsProp,
    onUiSettingsChange,
}: SettingsPanelProps) {
    const runtime = getRuntimeContext();
    const supportsWeather = typeof navigator !== "undefined" && "geolocation" in navigator;

    const {
        settings,
        showAddForm,
        setShowAddForm,
        form,
        setForm,
        formError,
        setFormError,
        selectTarget,
        deleteCustom,
        handleAddSubmit,
    } = useBeaconSettings();
    const [syncDefaults, setSyncDefaults] = useState<boolean>(getSyncDefaultsFromLatest);
    const [remoteImport, setRemoteImport] = useState<RemoteImportState>({
        value: "",
        loading: false,
        message: null,
        ok: false,
    });
    const [supportExportMessage, setSupportExportMessage] = useState<string | null>(null);
    const [desktopStatus, setDesktopStatus] = useState(getDesktopStatus);
    const [localFilesWarning, setLocalFilesWarning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const mediaLibrary = usePlayerStore(s => s.mediaLibrary);
    const setPlayback = usePlayerStore(s => s.setPlayback);
    const setPlayerMode = usePlayerStore(s => s.setPlayerMode);

    const [localUiSettings, setLocalUiSettings] = useState<UiSettings>(
        () => uiSettingsProp ?? readUiSettings(),
    );
    const effectiveUiSettings = uiSettingsProp ?? localUiSettings;

    function patchUiSettings(patch: Partial<UiSettings>) {
        const next = writeUiSettings(patch);
        setLocalUiSettings(next);
        onUiSettingsChange?.(next);
    }

    function applyImportedPrefs() {
        const imported = readPrefs();
        if (!imported) return;
        setPlayback({
            ...(typeof imported.volume === "number" ? { volume: imported.volume } : {}),
            ...(typeof imported.muted === "boolean" ? { isMuted: imported.muted } : {}),
        });
        if (typeof imported.mode === "string" && imported.mode) {
            setPlayerMode(imported.mode as PlayerMode);
        }
    }

    async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const ok = await importPrefsFromFile(file);
        if (ok) {
            applyImportedPrefs();
            setRemoteImport({
                value: remoteImport.value,
                loading: false,
                message: `${file.name} imported.`,
                ok: true,
            });
        } else {
            setRemoteImport({
                value: remoteImport.value,
                loading: false,
                message: `Couldn't import ${file.name}.`,
                ok: false,
            });
        }
    }

    async function handleRemoteImport() {
        const candidates = resolveRemoteImportCandidates(remoteImport.value);
        if (candidates.length === 0) {
            setRemoteImport(prev => ({
                ...prev,
                message: "Enter a direct .wid/.waldiez URL, a GitHub blob/raw URL, or owner/repo[/path].",
                ok: false,
            }));
            return;
        }

        setRemoteImport(prev => ({ ...prev, loading: true, message: null, ok: false }));
        let importedFrom: string | null = null;
        for (const candidate of candidates) {
            const ok = await importPrefsFromUrl(candidate);
            if (ok) {
                importedFrom = candidate;
                break;
            }
        }

        if (!importedFrom) {
            setRemoteImport(prev => ({
                ...prev,
                loading: false,
                message:
                    "Import failed. Check the URL/repo path and that the repo exposes a .wid or .waldiez file.",
                ok: false,
            }));
            return;
        }

        applyImportedPrefs();
        setRemoteImport(prev => ({
            ...prev,
            loading: false,
            message: `Imported from ${importedFrom}.`,
            ok: true,
        }));
    }

    function handleExportPrefs() {
        const { skippedLocalFiles } = exportPrefsAsWid(mediaLibrary);
        if (skippedLocalFiles > 0) {
            setLocalFilesWarning(true);
            setTimeout(() => setLocalFilesWarning(false), 4000);
        }
    }

    function handleExportBundle() {
        const { skippedLocalFiles } = exportPrefsAsWaldiez(mediaLibrary);
        if (skippedLocalFiles > 0) {
            setLocalFilesWarning(true);
            setTimeout(() => setLocalFilesWarning(false), 4000);
        }
    }

    async function handleExportSupportSnapshot() {
        try {
            const destination = await exportSupportSnapshot();
            setSupportExportMessage(`Support snapshot saved as ${destination}.`);
        } catch {
            setSupportExportMessage("Failed to export support snapshot.");
        }
    }

    const builtInTargets = STREAM_TARGETS.filter(isBeaconCapableTarget);
    const supportedCustomTargets = settings.customTargets.filter(isBeaconCapableTarget);
    const unsupportedCustomTargets = settings.customTargets.filter(t => !isBeaconCapableTarget(t));
    const allTargets = [...builtInTargets, ...supportedCustomTargets];
    const active = allTargets.find(t => t.id === settings.activeTargetId) ?? null;

    useEffect(() => subscribeDesktopStatus(() => setDesktopStatus(getDesktopStatus())), []);

    return (
        <div className={cn("flex h-full flex-col", className)}>
            <div className="border-b border-player-border p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold">
                            <Settings className="h-4 w-4" />
                            Settings
                        </h2>
                        <p className="mt-1 text-xs text-player-text-muted">
                            {runtime.isPackagedDesktop ? "Desktop" : runtime.isTauri ? "Tauri Dev" : "Web"}{" "}
                            configuration, preset import, and live-sync setup.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-player-text-muted hover:bg-player-border hover:text-player-text"
                        aria-label="Close settings"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 space-y-4 overflow-auto p-4">
                <SectionCard
                    icon={<FileInput className="h-4 w-4" />}
                    title="Presets And Defaults"
                    hint="Import or export player state, keep synced defaults, or pull a preset directly from GitHub."
                >
                    <ToggleRow
                        checked={syncDefaults}
                        onChange={next => {
                            setSyncDefaults(next);
                            setSyncDefaultsFromLatest(next);
                        }}
                        label="Sync defaults from latest deployed preset"
                        description="On startup, prefer the latest published repo preset and fall back to default.wid. Turn this off to keep local defaults untouched."
                    />

                    <div className="rounded-lg border border-player-border bg-player-bg/40 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                            Import
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 rounded bg-player-border px-3 py-2 text-xs text-player-text-muted hover:text-player-text"
                            >
                                <Upload className="h-3.5 w-3.5" />
                                Local file
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".wid,.waldiez,.json"
                                className="hidden"
                                onChange={handleImportFileChange}
                            />
                            <input
                                type="text"
                                value={remoteImport.value}
                                onChange={e =>
                                    setRemoteImport(prev => ({
                                        ...prev,
                                        value: e.target.value,
                                        message: null,
                                        ok: false,
                                    }))
                                }
                                placeholder="https://.../preset.wid or owner/repo[/path]"
                                className="min-w-0 flex-1 rounded border border-player-border bg-player-bg px-3 py-2 text-xs text-player-text outline-none focus:border-player-accent"
                            />
                            <button
                                type="button"
                                onClick={() => void handleRemoteImport()}
                                disabled={remoteImport.loading}
                                className="inline-flex items-center gap-1.5 rounded bg-player-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                                <Link2 className="h-3.5 w-3.5" />
                                {remoteImport.loading ? "Importing..." : "Import URL"}
                            </button>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-player-text-muted">
                            Supports direct `.wid`/`.waldiez` URLs, GitHub blob/raw URLs, and shorthand like{" "}
                            <code>owner/repo</code> or <code>owner/repo/path/to/preset.wid</code>.
                        </p>
                        {remoteImport.message && (
                            <p
                                className={cn(
                                    "mt-2 text-[11px]",
                                    remoteImport.ok ? "text-emerald-400" : "text-amber-400",
                                )}
                            >
                                {remoteImport.message}
                            </p>
                        )}
                    </div>

                    <div className="rounded-lg border border-player-border bg-player-bg/40 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                            Export
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleExportPrefs}
                                className="inline-flex items-center gap-1.5 rounded bg-player-border px-3 py-2 text-xs text-player-text-muted hover:text-player-text"
                                type="button"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export .wid
                            </button>
                            <button
                                onClick={handleExportBundle}
                                className="inline-flex items-center gap-1.5 rounded bg-player-border px-3 py-2 text-xs text-player-text-muted hover:text-player-text"
                                type="button"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export .waldiez
                            </button>
                        </div>
                        {localFilesWarning && (
                            <p className="mt-2 text-[11px] text-amber-400">
                                Local files are excluded from exported presets. Cloud/URL sources are
                                preserved.
                            </p>
                        )}
                    </div>
                </SectionCard>

                <SectionCard
                    icon={<HardDriveDownload className="h-4 w-4" />}
                    title="Desktop Status"
                    hint="Startup readiness for the desktop runtime and native playback backends."
                >
                    <div className="rounded-lg border border-player-border bg-player-bg/40 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                                    Runtime
                                </div>
                                <div className="mt-1 text-sm text-player-text">{desktopStatus.runtime}</div>
                            </div>
                            <span
                                className={cn(
                                    "rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                                    DESKTOP_STATUS_BADGE[desktopStatus.overall].className,
                                )}
                            >
                                {DESKTOP_STATUS_BADGE[desktopStatus.overall].label}
                            </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-player-text-muted">
                            {desktopStatus.summary}
                        </p>
                        {desktopStatus.checkedAt && (
                            <p className="mt-2 text-[11px] text-player-text-muted/80">
                                Last checked: {new Date(desktopStatus.checkedAt).toLocaleString()}
                            </p>
                        )}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <DesktopStatusPill
                                label="yt-dlp"
                                value={desktopStatus.backends.ytDlp}
                                className={CAPABILITY_BADGE[desktopStatus.backends.ytDlp]}
                            />
                            <DesktopStatusPill
                                label="mpv"
                                value={desktopStatus.backends.mpv}
                                className={CAPABILITY_BADGE[desktopStatus.backends.mpv]}
                            />
                            <DesktopStatusPill
                                label="File open"
                                value={
                                    desktopStatus.fileOpenEvents === false
                                        ? "error"
                                        : desktopStatus.fileOpenEvents === true
                                          ? "ready"
                                          : "unavailable"
                                }
                                className={
                                    desktopStatus.fileOpenEvents === false
                                        ? CAPABILITY_BADGE.error
                                        : desktopStatus.fileOpenEvents === true
                                          ? CAPABILITY_BADGE.ready
                                          : CAPABILITY_BADGE.unavailable
                                }
                            />
                            <DesktopStatusPill
                                label="Deep links"
                                value={
                                    desktopStatus.deepLinkEvents === false
                                        ? "error"
                                        : desktopStatus.deepLinkEvents === true
                                          ? "ready"
                                          : "unavailable"
                                }
                                className={
                                    desktopStatus.deepLinkEvents === false
                                        ? CAPABILITY_BADGE.error
                                        : desktopStatus.deepLinkEvents === true
                                          ? CAPABILITY_BADGE.ready
                                          : CAPABILITY_BADGE.unavailable
                                }
                            />
                        </div>
                        {(runtime.isTauri || runtime.isFlutterWebView) && (
                            <button
                                type="button"
                                onClick={() => void refreshDesktopStatus()}
                                className="mt-3 inline-flex items-center gap-1.5 rounded bg-player-border px-3 py-2 text-xs text-player-text-muted hover:text-player-text"
                            >
                                <MonitorPlay className="h-3.5 w-3.5" />
                                Refresh desktop check
                            </button>
                        )}
                    </div>
                </SectionCard>

                <SectionCard
                    icon={<MonitorPlay className="h-4 w-4" />}
                    title="Playback And Display"
                    hint="Foreground/background behavior and screensaver settings."
                >
                    <ToggleRow
                        checked={effectiveUiSettings.pausePlaybackWhenHidden}
                        onChange={checked => patchUiSettings({ pausePlaybackWhenHidden: checked })}
                        label="Pause when app is hidden"
                        description="Useful for power saving. Turn this off if you want playback to continue in the background."
                    />

                    <ToggleRow
                        checked={effectiveUiSettings.showYtFallbackDiagnostics}
                        onChange={checked => patchUiSettings({ showYtFallbackDiagnostics: checked })}
                        label="Show YouTube fallback diagnostic"
                        description="Display a warning when YouTube native audio resolution fails and the embed fallback is used. Off by default."
                    />

                    <ToggleRow
                        checked={effectiveUiSettings.screensaverEnabled}
                        onChange={checked => patchUiSettings({ screensaverEnabled: checked })}
                        label="Enable screensaver after inactivity"
                    />

                    <div
                        className={cn(
                            "rounded-lg border border-player-border bg-player-bg/40 p-3",
                            !effectiveUiSettings.screensaverEnabled && "pointer-events-none opacity-50",
                        )}
                    >
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                            Screensaver timeout
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {([5, 10, 15, 30] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => patchUiSettings({ screensaverTimeoutMinutes: m })}
                                    className={cn(
                                        "rounded px-2.5 py-1 text-xs",
                                        m === effectiveUiSettings.screensaverTimeoutMinutes
                                            ? "bg-player-accent text-white"
                                            : "bg-player-border text-player-text-muted hover:text-player-text",
                                    )}
                                >
                                    {m} min
                                </button>
                            ))}
                        </div>
                        <div className="mt-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                                Style
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(["minimal", "animated", "artwork"] as ScreensaverStyle[]).map(style => (
                                    <button
                                        key={style}
                                        onClick={() => patchUiSettings({ screensaverStyle: style })}
                                        className={cn(
                                            "rounded px-2.5 py-1 text-xs capitalize",
                                            style === effectiveUiSettings.screensaverStyle
                                                ? "bg-player-accent text-white"
                                                : "bg-player-border text-player-text-muted hover:text-player-text",
                                        )}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    icon={<KeyRound className="h-4 w-4" />}
                    title="Search And Metadata"
                    hint="Optional local API keys that improve search fallback and local media enrichment."
                >
                    <div className="rounded-lg border border-player-border bg-player-bg/40 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                            YouTube Search
                        </div>
                        <p className="mb-2 text-xs text-player-text-muted">
                            Use your own YouTube Data API key for client-side search fallback.
                        </p>
                        <input
                            type="password"
                            autoComplete="off"
                            spellCheck={false}
                            value={effectiveUiSettings.youtubeApiKey}
                            onChange={e => patchUiSettings({ youtubeApiKey: e.target.value.trim() })}
                            placeholder="AIza..."
                            className="w-full rounded border border-player-border bg-player-bg px-3 py-2 text-xs text-player-text outline-none focus:border-player-accent"
                        />
                    </div>

                    <div className="rounded-lg border border-player-border bg-player-bg/40 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                            TMDB Metadata
                        </div>
                        <p className="mb-2 text-xs text-player-text-muted">
                            Enrich local video files with posters and descriptions.
                        </p>
                        <div className="mb-2">
                            <a
                                href="https://www.themoviedb.org/settings/api"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-player-accent hover:underline"
                            >
                                Get a free TMDB API key
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                        <input
                            type="password"
                            autoComplete="off"
                            spellCheck={false}
                            value={effectiveUiSettings.tmdbApiKey}
                            onChange={e => patchUiSettings({ tmdbApiKey: e.target.value.trim() })}
                            placeholder="eyJ..."
                            className="w-full rounded border border-player-border bg-player-bg px-3 py-2 text-xs text-player-text outline-none focus:border-player-accent"
                        />
                    </div>
                </SectionCard>

                {supportsWeather && (
                    <WeatherMoodSection uiSettings={effectiveUiSettings} patchUiSettings={patchUiSettings} />
                )}

                <SectionCard
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title="Support Snapshot"
                    hint="Export a redacted diagnostics file for QA or bug reports. API keys and local file paths are not exported verbatim."
                >
                    <div className="rounded-lg border border-player-border bg-player-bg/40 p-3">
                        <button
                            type="button"
                            onClick={() => void handleExportSupportSnapshot()}
                            className="inline-flex items-center gap-1.5 rounded bg-player-border px-3 py-2 text-xs text-player-text-muted hover:text-player-text"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Export support snapshot
                        </button>
                        <p className="mt-2 text-[11px] leading-5 text-player-text-muted">
                            Includes runtime, playback, current source summary, settings summaries, preset
                            metadata, and desktop backend availability.
                        </p>
                        {supportExportMessage && (
                            <p className="mt-2 text-[11px] text-player-accent">{supportExportMessage}</p>
                        )}
                    </div>
                </SectionCard>

                <SectionCard
                    icon={<Radio className="h-4 w-4" />}
                    title="Live Sync"
                    hint="Choose where player beacon state is published. Only beacon-capable transports are shown here."
                >
                    <div className="space-y-2">
                        {builtInTargets.map(t => {
                            const selected = settings.activeTargetId === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => selectTarget(t.id)}
                                    className={cn(
                                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                                        selected
                                            ? "border-player-accent bg-player-accent/10"
                                            : "border-player-border bg-player-bg/40 hover:border-player-accent/50",
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={cn(
                                                "h-3 w-3 shrink-0 rounded-full border-2",
                                                selected
                                                    ? "border-player-accent bg-player-accent"
                                                    : "border-player-text-muted",
                                            )}
                                        />
                                        <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                                        <span
                                            className={cn(
                                                "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase",
                                                PROTOCOL_BADGE[t.protocol],
                                            )}
                                        >
                                            {t.protocol}
                                        </span>
                                    </div>
                                    <div className="mt-1 pl-5 text-[11px] text-player-text-muted">
                                        {t.url ?? ""}
                                        {t.channel && <span className="ml-1 opacity-70">· {t.channel}</span>}
                                    </div>
                                </button>
                            );
                        })}

                        {supportedCustomTargets.length > 0 && (
                            <div className="pt-2">
                                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-player-text-muted">
                                    Custom
                                </div>
                                <div className="space-y-2">
                                    {supportedCustomTargets.map(t => {
                                        const selected = settings.activeTargetId === t.id;
                                        return (
                                            <div key={t.id} className="flex gap-2">
                                                <button
                                                    onClick={() => selectTarget(t.id)}
                                                    className={cn(
                                                        "min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                                        selected
                                                            ? "border-player-accent bg-player-accent/10"
                                                            : "border-player-border bg-player-bg/40 hover:border-player-accent/50",
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={cn(
                                                                "h-3 w-3 shrink-0 rounded-full border-2",
                                                                selected
                                                                    ? "border-player-accent bg-player-accent"
                                                                    : "border-player-text-muted",
                                                            )}
                                                        />
                                                        <span className="flex-1 truncate text-sm font-medium">
                                                            {t.name}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase",
                                                                PROTOCOL_BADGE[t.protocol],
                                                            )}
                                                        >
                                                            {t.protocol}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 pl-5 text-[11px] text-player-text-muted">
                                                        {t.url ?? ""}
                                                        {t.subTopic && (
                                                            <span className="ml-1 opacity-70">
                                                                sub: {t.subTopic}
                                                            </span>
                                                        )}
                                                        {t.pubTopic && (
                                                            <span className="ml-1 opacity-70">
                                                                pub: {t.pubTopic}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => deleteCustom(t.id)}
                                                    className="shrink-0 self-center rounded p-1.5 text-player-text-muted hover:bg-red-500/10 hover:text-red-400"
                                                    aria-label={`Delete ${t.name}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {!showAddForm ? (
                        <button
                            onClick={() => {
                                setShowAddForm(true);
                                setForm(emptyForm());
                                setFormError(null);
                            }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-player-border py-2 text-xs text-player-text-muted transition-colors hover:border-player-accent/50 hover:text-player-text"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Custom Beacon Endpoint
                        </button>
                    ) : (
                        <AddTargetForm
                            form={form}
                            error={formError}
                            onChange={f => {
                                setForm(f);
                                setFormError(null);
                            }}
                            onSubmit={handleAddSubmit}
                            onCancel={() => {
                                setShowAddForm(false);
                                setFormError(null);
                            }}
                        />
                    )}

                    {unsupportedCustomTargets.length > 0 && (
                        <div className="rounded-lg border border-player-border bg-player-bg/40 p-3 text-[11px] text-player-text-muted">
                            {unsupportedCustomTargets.length} legacy custom endpoint
                            {unsupportedCustomTargets.length === 1 ? "" : "s"} hidden here because they do not
                            support beacon state.
                        </div>
                    )}

                    {active && (
                        <div className="rounded-lg border border-player-border bg-player-bg/40 p-3 text-[11px] text-player-text-muted">
                            <div className="mb-1 font-semibold text-player-text">Active target</div>
                            <div>{active.name}</div>
                            <div className="mt-1 break-all font-mono text-[10px]">{active.url}</div>
                        </div>
                    )}
                </SectionCard>
            </div>
        </div>
    );
}

function DesktopStatusPill({ label, value, className }: { label: string; value: string; className: string }) {
    return (
        <div className="rounded-lg border border-player-border bg-player-bg/50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-player-text-muted">
                {label}
            </div>
            <span
                className={cn(
                    "mt-2 inline-flex rounded px-2 py-1 text-[10px] font-semibold uppercase",
                    className,
                )}
            >
                {value}
            </span>
        </div>
    );
}

interface AddTargetFormProps {
    form: AddForm;
    error: string | null;
    onChange: (f: AddForm) => void;
    onSubmit: () => void;
    onCancel: () => void;
}

function AddTargetForm({ form, error, onChange, onSubmit, onCancel }: AddTargetFormProps) {
    const isMqtt = form.protocol === "mqtts";
    const inputCls =
        "w-full rounded border border-player-border bg-player-bg px-3 py-2 text-xs text-player-text placeholder:text-player-text-muted focus:border-player-accent focus:outline-none";
    const labelCls = "mb-1 block text-[10px] uppercase tracking-wide text-player-text-muted";

    return (
        <div className="rounded-lg border border-player-accent/40 bg-player-bg/40 p-3">
            <div className="mb-3 text-xs font-semibold text-player-text">New Beacon Endpoint</div>

            <div className="space-y-3">
                <div>
                    <label className={labelCls}>Name</label>
                    <input
                        className={inputCls}
                        placeholder="My server"
                        value={form.name}
                        onChange={e => onChange({ ...form, name: e.target.value })}
                        autoFocus
                    />
                </div>

                <div>
                    <label className={labelCls}>Protocol</label>
                    <select
                        className={inputCls}
                        value={form.protocol}
                        onChange={e => onChange({ ...form, protocol: e.target.value as StreamProtocol })}
                    >
                        {BEACON_PROTOCOL_OPTIONS.map(p => (
                            <option key={p} value={p}>
                                {p.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelCls}>URL</label>
                    <input
                        className={inputCls}
                        placeholder={isMqtt ? "wss://mqtt.example.com/mqtt" : "wss://example.com/ws"}
                        value={form.url}
                        onChange={e => onChange({ ...form, url: e.target.value })}
                    />
                </div>

                {isMqtt && (
                    <>
                        <div>
                            <label className={labelCls}>Subscribe topic</label>
                            <input
                                className={inputCls}
                                placeholder="player/commands"
                                value={form.subTopic}
                                onChange={e => onChange({ ...form, subTopic: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Publish topic</label>
                            <input
                                className={inputCls}
                                placeholder="player/state"
                                value={form.pubTopic}
                                onChange={e => onChange({ ...form, pubTopic: e.target.value })}
                            />
                        </div>
                    </>
                )}
            </div>

            {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

            <div className="mt-3 flex gap-2">
                <button
                    onClick={onSubmit}
                    className="flex-1 rounded bg-player-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                >
                    Add endpoint
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 rounded border border-player-border px-3 py-2 text-xs text-player-text-muted hover:bg-player-border"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
