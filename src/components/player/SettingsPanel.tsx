/**
 * SettingsPanel — right-side drawer for configuring beacon endpoints.
 *
 * Shows all built-in STREAM_TARGETS plus any user-defined custom targets.
 * The user selects which one is "active" for the state beacon.  Custom
 * targets can be added (name, protocol, URL, MQTT pub/sub topics) and
 * deleted.  Changes are persisted to localStorage via beaconSettings.
 */
import {
    type BeaconSettings,
    type BeaconTarget,
    readBeaconSettings,
    writeBeaconSettings,
} from "@/lib/beaconSettings";
import { getSyncDefaultsFromLatest, setSyncDefaultsFromLatest } from "@/lib/moodDefaults";
import { STREAM_TARGETS, isBeaconCapableTarget } from "@/lib/streamTargets";
import { cn } from "@/lib/utils";
import { nextWid } from "@/lib/wid";
import type { StreamProtocol } from "@/types/player";

import { useState } from "react";

import { Plus, Radio, Settings, Trash2, X } from "lucide-react";

const PROTOCOL_OPTIONS: StreamProtocol[] = ["ws", "wss", "mqtts", "webrtc", "rtsp", "http", "https"];

const PROTOCOL_BADGE: Record<StreamProtocol, string> = {
    ws: "bg-green-500/20 text-green-400",
    wss: "bg-blue-500/20 text-blue-400",
    mqtts: "bg-orange-500/20 text-orange-400",
    webrtc: "bg-purple-500/20 text-purple-400",
    rtsp: "bg-yellow-500/20 text-yellow-400",
    http: "bg-gray-500/20 text-gray-400",
    https: "bg-gray-500/20 text-gray-400",
};

interface SettingsPanelProps {
    onClose: () => void;
    className?: string;
}

type AddForm = {
    name: string;
    protocol: StreamProtocol;
    url: string;
    subTopic: string;
    pubTopic: string;
    signalingUrl: string;
};

const emptyForm = (): AddForm => ({
    name: "",
    protocol: "wss",
    url: "",
    subTopic: "",
    pubTopic: "",
    signalingUrl: "",
});

export function SettingsPanel({ onClose, className }: SettingsPanelProps) {
    const [settings, setSettings] = useState<BeaconSettings>(readBeaconSettings);
    const [syncDefaults, setSyncDefaults] = useState<boolean>(getSyncDefaultsFromLatest);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState<AddForm>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);

    function save(next: BeaconSettings) {
        writeBeaconSettings(next);
        setSettings(next);
    }

    function selectTarget(id: string) {
        save({ ...settings, activeTargetId: id });
    }

    function deleteCustom(id: string) {
        save({
            ...settings,
            customTargets: settings.customTargets.filter(t => t.id !== id),
            activeTargetId: settings.activeTargetId === id ? "default-wss" : settings.activeTargetId,
        });
    }

    function handleAddSubmit() {
        if (!form.name.trim()) {
            setFormError("Name is required.");
            return;
        }
        const needsUrl = form.protocol !== "webrtc";
        if (needsUrl && !form.url.trim()) {
            setFormError("URL is required for this protocol.");
            return;
        }
        if (form.protocol === "webrtc" && !form.signalingUrl.trim()) {
            setFormError("Signaling URL is required for WebRTC.");
            return;
        }
        const target: BeaconTarget = {
            id: nextWid(),
            name: form.name.trim(),
            protocol: form.protocol,
            isCustom: true,
            ...(form.url && { url: form.url.trim() }),
            ...(form.subTopic && { subTopic: form.subTopic.trim() }),
            ...(form.pubTopic && { pubTopic: form.pubTopic.trim() }),
            ...(form.signalingUrl && { signalingUrl: form.signalingUrl.trim() }),
        };
        save({
            ...settings,
            customTargets: [...settings.customTargets, target],
            activeTargetId: target.id,
        });
        setShowAddForm(false);
        setForm(emptyForm());
        setFormError(null);
    }

    const allTargets = [...STREAM_TARGETS, ...settings.customTargets];

    return (
        <div className={cn("flex h-full flex-col", className)}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-player-border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                    <Settings className="h-4 w-4" />
                    Settings
                </h2>
                <button
                    onClick={onClose}
                    className="rounded p-1 text-player-text-muted hover:bg-player-border hover:text-player-text"
                    aria-label="Close settings"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {/* ── Defaults Sync ── */}
                <section className="mb-4 rounded-lg border border-player-border bg-player-surface p-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                        Defaults Sync
                    </div>
                    <label className="flex cursor-pointer items-start gap-2">
                        <input
                            type="checkbox"
                            checked={syncDefaults}
                            onChange={e => {
                                const next = e.target.checked;
                                setSyncDefaults(next);
                                setSyncDefaultsFromLatest(next);
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-player-border bg-player-bg"
                        />
                        <span className="text-xs text-player-text-muted">
                            Sync defaults from latest deployed <code>default.wid</code> on app start. Turn off
                            to keep local customized defaults unchanged.
                        </span>
                    </label>
                </section>

                {/* ── Beacon Endpoints ── */}
                <section>
                    <div className="mb-3 flex items-center gap-2">
                        <Radio className="h-3.5 w-3.5 text-player-text-muted" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-player-text-muted">
                            Beacon Endpoints
                        </span>
                    </div>

                    <div className="space-y-2">
                        {/* Built-in targets */}
                        {STREAM_TARGETS.map(t => {
                            const active = settings.activeTargetId === t.id;
                            const beaconOk = isBeaconCapableTarget(t);
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => selectTarget(t.id)}
                                    className={cn(
                                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                                        active
                                            ? "border-player-accent bg-player-accent/10"
                                            : "border-player-border bg-player-surface hover:border-player-accent/50",
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={cn(
                                                "h-3 w-3 shrink-0 rounded-full border-2",
                                                active
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
                                        {t.url ?? t.signalingUrl ?? ""}
                                        {t.channel && <span className="ml-1 opacity-70">· {t.channel}</span>}
                                    </div>
                                    {!beaconOk && (
                                        <div className="mt-1 pl-5 text-[10px] text-yellow-500/70">
                                            not usable as beacon (ws/wss/mqtt-ws only)
                                        </div>
                                    )}
                                    <div className="mt-0.5 pl-5 text-[10px] text-player-text-muted opacity-60">
                                        {t.role}
                                    </div>
                                </button>
                            );
                        })}

                        {/* Custom targets */}
                        {settings.customTargets.length > 0 && (
                            <>
                                <div className="my-2 border-t border-player-border pt-2 text-[10px] uppercase tracking-wider text-player-text-muted">
                                    Custom
                                </div>
                                {settings.customTargets.map(t => {
                                    const active = settings.activeTargetId === t.id;
                                    const beaconOk = isBeaconCapableTarget(t);
                                    return (
                                        <div key={t.id} className="flex items-stretch gap-1">
                                            <button
                                                onClick={() => selectTarget(t.id)}
                                                className={cn(
                                                    "min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                                    active
                                                        ? "border-player-accent bg-player-accent/10"
                                                        : "border-player-border bg-player-surface hover:border-player-accent/50",
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={cn(
                                                            "h-3 w-3 shrink-0 rounded-full border-2",
                                                            active
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
                                                    {t.url ?? t.signalingUrl ?? ""}
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
                                                {!beaconOk && (
                                                    <div className="mt-1 pl-5 text-[10px] text-yellow-500/70">
                                                        not usable as beacon (ws/wss/mqtt-ws only)
                                                    </div>
                                                )}
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
                            </>
                        )}
                    </div>

                    {/* Add custom target */}
                    {!showAddForm ? (
                        <button
                            onClick={() => {
                                setShowAddForm(true);
                                setForm(emptyForm());
                                setFormError(null);
                            }}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-player-border py-2 text-xs text-player-text-muted transition-colors hover:border-player-accent/50 hover:text-player-text"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Custom Endpoint
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
                </section>

                {/* Active target info */}
                {(() => {
                    const active = allTargets.find(t => t.id === settings.activeTargetId);
                    if (!active) return null;
                    const beaconUrl =
                        active.url?.startsWith("ws://") || active.url?.startsWith("wss://")
                            ? active.url
                            : null;
                    return (
                        <div className="mt-4 rounded-lg border border-player-border bg-player-surface p-3 text-[11px] text-player-text-muted">
                            <div className="mb-1 font-semibold text-player-text">Active beacon target</div>
                            <div>
                                <span className="opacity-70">Name: </span>
                                {active.name}
                            </div>
                            {beaconUrl ? (
                                <div className="mt-0.5 break-all font-mono text-[10px]">{beaconUrl}</div>
                            ) : (
                                <div className="mt-0.5 text-yellow-500/80">
                                    This target cannot send beacon data (ws/wss required).
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

// ── Add target inline form ────────────────────────────────────────────────

interface AddTargetFormProps {
    form: AddForm;
    error: string | null;
    onChange: (f: AddForm) => void;
    onSubmit: () => void;
    onCancel: () => void;
}

function AddTargetForm({ form, error, onChange, onSubmit, onCancel }: AddTargetFormProps) {
    const isMqtt = form.protocol === "mqtts";
    const isWebRTC = form.protocol === "webrtc";

    const inputCls =
        "w-full rounded border border-player-border bg-player-bg px-2 py-1.5 text-xs text-player-text placeholder:text-player-text-muted focus:border-player-accent focus:outline-none";
    const labelCls = "mb-0.5 block text-[10px] uppercase tracking-wide text-player-text-muted";

    return (
        <div className="mt-3 rounded-lg border border-player-accent/40 bg-player-surface p-3">
            <div className="mb-3 text-xs font-semibold">New Endpoint</div>

            <div className="space-y-2">
                <div>
                    <label className={labelCls}>Name</label>
                    <input
                        className={inputCls}
                        placeholder="My Server"
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
                        {PROTOCOL_OPTIONS.map(p => (
                            <option key={p} value={p}>
                                {p.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>

                {!isWebRTC && (
                    <div>
                        <label className={labelCls}>URL</label>
                        <input
                            className={inputCls}
                            placeholder={
                                isMqtt ? "mqtts://mqtt.example.com:8883" : "wss://example.com/stream"
                            }
                            value={form.url}
                            onChange={e => onChange({ ...form, url: e.target.value })}
                        />
                    </div>
                )}

                {isWebRTC && (
                    <div>
                        <label className={labelCls}>Signaling URL</label>
                        <input
                            className={inputCls}
                            placeholder="wss://signal.example.com/ws"
                            value={form.signalingUrl}
                            onChange={e => onChange({ ...form, signalingUrl: e.target.value })}
                        />
                    </div>
                )}

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
                                placeholder="player/state (defaults to sub topic)"
                                value={form.pubTopic}
                                onChange={e => onChange({ ...form, pubTopic: e.target.value })}
                            />
                        </div>
                    </>
                )}

                {(form.protocol === "webrtc" || isMqtt) && !isWebRTC && (
                    <div>
                        <label className={labelCls}>
                            {isMqtt ? "Default topic / channel" : "Room / channel"}
                        </label>
                        <input
                            className={inputCls}
                            placeholder="player/live"
                            value={form.subTopic}
                            onChange={e => onChange({ ...form, subTopic: e.target.value })}
                        />
                    </div>
                )}
            </div>

            {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

            <div className="mt-3 flex gap-2">
                <button
                    onClick={onSubmit}
                    className="flex-1 rounded bg-player-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                    Add
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
