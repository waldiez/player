/**
 * AddDeviceDialog — modal for adding camera, microphone, screen capture,
 * or network stream sources.  Four tabs: Camera | Mic | Screen | Network.
 */
import {
    enumerateAudioInputDevices,
    enumerateAudioOutputDevices,
    enumerateVideoDevices,
    isAudioOutputSelectionSupported,
    isScreenCaptureSupported,
    isTauri,
    launchOpenCvCapture,
    pendingStreams,
} from "@/lib/deviceSource";
import { STREAM_TARGETS } from "@/lib/streamTargets";
import { cn } from "@/lib/utils";
import { nextWid } from "@/lib/wid";
import { usePlayerStore } from "@/stores";
import type { MediaFile, StreamProtocol } from "@/types";

import { useEffect, useState } from "react";

import { AlertTriangle, Camera, Mic, Monitor, Radio, X } from "lucide-react";

interface AddDeviceDialogProps {
    onClose: () => void;
}

type Tab = "camera" | "mic" | "screen" | "stream";

const RESOLUTION_OPTIONS = [
    { value: "", label: "Default" },
    { value: "480p", label: "480p (854×480)" },
    { value: "720p", label: "720p (1280×720)" },
    { value: "1080p", label: "1080p (1920×1080)" },
];

const FPS_OPTIONS = [
    { value: 0, label: "Default" },
    { value: 15, label: "15 fps" },
    { value: 30, label: "30 fps" },
    { value: 60, label: "60 fps" },
];

export function AddDeviceDialog({ onClose }: AddDeviceDialogProps) {
    const [tab, setTab] = useState<Tab>("camera");
    const { addToLibrary, setCurrentMedia } = usePlayerStore();

    // ── Shared: device lists ──────────────────────────────────────────────
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
    const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);

    // ── Camera tab ────────────────────────────────────────────────────────
    const [selectedCamera, setSelectedCamera] = useState("");
    const [facingMode, setFacingMode] = useState<"" | "user" | "environment">("");
    const [resolution, setResolution] = useState("");
    const [fps, setFps] = useState(0);
    const [cameraWithMic, setCameraWithMic] = useState(false);
    const [cameraAudioId, setCameraAudioId] = useState("");

    // ── Mic tab ───────────────────────────────────────────────────────────
    const [selectedMic, setSelectedMic] = useState("");
    const [micSpeakerId, setMicSpeakerId] = useState("");

    // ── Screen tab ────────────────────────────────────────────────────────
    const [screenSystemAudio, setScreenSystemAudio] = useState(false);
    const [screenWithMic, setScreenWithMic] = useState(false);
    const [screenMicId, setScreenMicId] = useState("");
    const [screenSpeakerId, setScreenSpeakerId] = useState("");
    const [screenLaunching, setScreenLaunching] = useState(false);
    const [screenError, setScreenError] = useState<string | null>(null);

    // ── Stream tab ────────────────────────────────────────────────────────
    const [streamTargetId, setStreamTargetId] = useState<string>("default-wss");
    const [streamUrl, setStreamUrl] = useState("");
    const [streamProtocol, setStreamProtocol] = useState<StreamProtocol>("http");
    const [streamChannel, setStreamChannel] = useState("");
    const [streamSignalingUrl, setStreamSignalingUrl] = useState("");
    const [streamError, setStreamError] = useState<string | null>(null);
    const [cvDevice, setCvDevice] = useState(0);
    const [cvPort, setCvPort] = useState(8888);
    const [cvLaunching, setCvLaunching] = useState(false);
    const [cvError, setCvError] = useState<string | null>(null);

    // ── Enumerate devices on mount ────────────────────────────────────────
    useEffect(() => {
        const listDevices = async () => {
            try {
                // Brief permission request to unlock labels
                const s = await navigator.mediaDevices
                    .getUserMedia({ audio: true, video: true })
                    .catch(() => null);
                if (s) s.getTracks().forEach(t => t.stop());
            } catch {
                // Labels may be empty if permission denied
            }
            const [cams, ins, outs] = await Promise.all([
                enumerateVideoDevices(),
                enumerateAudioInputDevices(),
                isAudioOutputSelectionSupported() ? enumerateAudioOutputDevices() : Promise.resolve([]),
            ]);
            setCameras(cams);
            setMics(ins);
            setSpeakers(outs);
        };
        listDevices();
    }, []);

    // ── Camera ────────────────────────────────────────────────────────────
    function addCamera() {
        const cam = cameras.find(c => c.deviceId === selectedCamera) ?? cameras[0];
        if (!cam) return;
        const idx = cameras.indexOf(cam);
        const mic = cameraWithMic ? (mics.find(m => m.deviceId === cameraAudioId) ?? mics[0]) : null;
        const entry: MediaFile = {
            id: nextWid(),
            name: cam.label || `Camera ${idx}`,
            path: `camera:${idx}`,
            type: "video",
            source: "camera",
            deviceId: cam.deviceId,
            audioDeviceId: mic?.deviceId,
            facingMode: facingMode || undefined,
            captureResolution: resolution || undefined,
            captureFrameRate: fps || undefined,
            duration: 0,
            size: 0,
            createdAt: new Date(),
        };
        addToLibrary(entry);
        setCurrentMedia(entry);
        onClose();
    }

    // ── Microphone ────────────────────────────────────────────────────────
    function addMic() {
        const mic = mics.find(m => m.deviceId === selectedMic) ?? mics[0];
        if (!mic) return;
        const idx = mics.indexOf(mic);
        const entry: MediaFile = {
            id: nextWid(),
            name: mic.label || `Microphone ${idx}`,
            path: `microphone:${idx}`,
            type: "audio",
            source: "microphone",
            deviceId: mic.deviceId,
            sinkId: micSpeakerId || undefined,
            duration: 0,
            size: 0,
            createdAt: new Date(),
        };
        addToLibrary(entry);
        setCurrentMedia(entry);
        onClose();
    }

    // ── Screen capture — MUST be triggered by direct user gesture ─────────
    async function handleAddScreen() {
        setScreenLaunching(true);
        setScreenError(null);
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: screenSystemAudio,
            });

            if (screenWithMic && mics.length > 0) {
                try {
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: screenMicId ? { deviceId: { exact: screenMicId } } : true,
                        video: false,
                    });
                    micStream.getAudioTracks().forEach(t => displayStream.addTrack(t));
                } catch {
                    // Mic denied — continue without it
                }
            }

            const id = nextWid();
            pendingStreams.set(id, displayStream);

            const entry: MediaFile = {
                id,
                name: "Screen Capture",
                path: "screen:0",
                type: "video",
                source: "screen",
                sinkId: screenSpeakerId || undefined,
                duration: 0,
                size: 0,
                createdAt: new Date(),
            };
            addToLibrary(entry);
            setCurrentMedia(entry);
            onClose();
        } catch (e) {
            if (e instanceof Error && e.name !== "AbortError") {
                setScreenError(e.message || "Screen capture failed.");
            }
        } finally {
            setScreenLaunching(false);
        }
    }

    // ── Network stream ────────────────────────────────────────────────────
    function addStream() {
        setStreamError(null);
        const url = streamUrl.trim();
        if (streamProtocol === "http" || streamProtocol === "https") {
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                setStreamError("Please enter a valid HTTP(S) stream URL.");
                return;
            }
        } else if (streamProtocol === "webrtc") {
            if (!streamSignalingUrl.trim().startsWith("wss://")) {
                setStreamError("WebRTC requires a secure WSS signaling URL.");
                return;
            }
        } else if (!url && !streamChannel.trim()) {
            setStreamError("Please set a URL or channel for this stream target.");
            return;
        }
        const rawName = url
            ? (url.split("/").filter(Boolean).pop()?.split("?")[0] ?? "Stream")
            : `${streamProtocol.toUpperCase()} stream`;
        const entry: MediaFile = {
            id: nextWid(),
            name: decodeURIComponent(rawName),
            path: url || `${streamProtocol}://${streamChannel || "stream"}`,
            type: "video",
            source: "stream",
            streamProtocol: streamProtocol,
            streamTargetId: streamTargetId || undefined,
            streamChannel: streamChannel || undefined,
            signalingUrl: streamSignalingUrl || undefined,
            duration: 0,
            size: 0,
            createdAt: new Date(),
        };
        addToLibrary(entry);
        setCurrentMedia(entry);
        onClose();
    }

    async function handleLaunchOpenCv() {
        setCvLaunching(true);
        setCvError(null);
        try {
            const url = await launchOpenCvCapture(cvDevice, cvPort);
            setStreamUrl(url);
            setStreamProtocol("http");
            setStreamTargetId("opencv-http");
        } catch (e) {
            setCvError(e instanceof Error ? e.message : "Failed to launch OpenCV server");
        } finally {
            setCvLaunching(false);
        }
    }

    // ── Tab config ────────────────────────────────────────────────────────
    const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
        { id: "camera", label: "Camera", Icon: Camera },
        { id: "mic", label: "Mic", Icon: Mic },
        { id: "screen", label: "Screen", Icon: Monitor },
        { id: "stream", label: "Network", Icon: Radio },
    ];

    const canAdd =
        tab === "camera"
            ? cameras.length > 0
            : tab === "mic"
              ? mics.length > 0
              : tab === "screen"
                ? !screenLaunching
                : streamProtocol === "webrtc"
                  ? !!streamSignalingUrl.trim()
                  : !!streamUrl.trim() || !!streamChannel.trim();

    // ── Select classes ────────────────────────────────────────────────────
    const selectCls =
        "w-full rounded-lg border border-[var(--color-player-border)] bg-[var(--color-player-bg)] px-3 py-2 text-sm text-[var(--color-player-text)] outline-none focus:border-[var(--color-player-accent)]";
    const inputCls =
        "w-full rounded-lg border border-[var(--color-player-border)] bg-[var(--color-player-bg)] px-3 py-2 text-sm text-[var(--color-player-text)] placeholder-[var(--color-player-text-muted)] outline-none focus:border-[var(--color-player-accent)]";

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog */}
            <div className="fixed left-1/2 top-1/2 z-50 w-[500px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-player-border)] bg-[var(--color-player-surface)] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--color-player-border)] px-5 py-3.5">
                    <span className="font-semibold text-[var(--color-player-text)]">Add Device / Stream</span>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-[var(--color-player-text-muted)] transition-colors hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--color-player-border)]">
                    {TABS.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                                tab === id
                                    ? "border-b-2 border-[var(--color-player-accent)] text-[var(--color-player-accent)]"
                                    : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="min-h-[120px] space-y-3 px-5 py-4">
                    {/* ── Camera ── */}
                    {tab === "camera" && (
                        <>
                            <p className="text-xs text-[var(--color-player-text-muted)]">
                                Live feed appears in the canvas. Optionally include a microphone.
                            </p>
                            {cameras.length === 0 ? (
                                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-400">
                                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>No cameras found or permission denied.</span>
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedCamera}
                                        onChange={e => setSelectedCamera(e.target.value)}
                                        className={selectCls}
                                        aria-label="Camera device"
                                    >
                                        {cameras.map((c, i) => (
                                            <option key={c.deviceId} value={c.deviceId}>
                                                {c.label || `Camera ${i}`}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Facing mode */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-[var(--color-player-text-muted)] w-16 flex-shrink-0">
                                            Facing
                                        </span>
                                        {(
                                            [
                                                { value: "", label: "Default" },
                                                { value: "user", label: "Front" },
                                                { value: "environment", label: "Rear" },
                                            ] as const
                                        ).map(opt => (
                                            <label
                                                key={opt.value}
                                                className="flex items-center gap-1 text-xs cursor-pointer text-[var(--color-player-text)]"
                                            >
                                                <input
                                                    type="radio"
                                                    name="facingMode"
                                                    value={opt.value}
                                                    checked={facingMode === opt.value}
                                                    onChange={() =>
                                                        setFacingMode(
                                                            opt.value as "" | "user" | "environment",
                                                        )
                                                    }
                                                    className="accent-[var(--color-player-accent)]"
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>

                                    {/* Resolution + FPS */}
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[10px] text-[var(--color-player-text-muted)]">
                                                Resolution
                                            </label>
                                            <select
                                                value={resolution}
                                                onChange={e => setResolution(e.target.value)}
                                                className={selectCls}
                                            >
                                                {RESOLUTION_OPTIONS.map(o => (
                                                    <option key={o.value} value={o.value}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="mb-1 block text-[10px] text-[var(--color-player-text-muted)]">
                                                FPS
                                            </label>
                                            <select
                                                value={fps}
                                                onChange={e => setFps(Number(e.target.value))}
                                                className={selectCls}
                                            >
                                                {FPS_OPTIONS.map(o => (
                                                    <option key={o.value} value={o.value}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Include mic toggle */}
                                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-player-text)]">
                                        <input
                                            type="checkbox"
                                            checked={cameraWithMic}
                                            onChange={e => setCameraWithMic(e.target.checked)}
                                            className="accent-[var(--color-player-accent)]"
                                        />
                                        Include microphone
                                    </label>
                                    {cameraWithMic && mics.length > 0 && (
                                        <select
                                            value={cameraAudioId}
                                            onChange={e => setCameraAudioId(e.target.value)}
                                            className={selectCls}
                                            aria-label="Microphone for camera"
                                        >
                                            {mics.map((m, i) => (
                                                <option key={m.deviceId} value={m.deviceId}>
                                                    {m.label || `Microphone ${i}`}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {cameraWithMic && mics.length === 0 && (
                                        <p className="text-xs text-[var(--color-player-text-muted)]">
                                            No microphones available.
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ── Microphone ── */}
                    {tab === "mic" && (
                        <>
                            <p className="text-xs text-[var(--color-player-text-muted)]">
                                Audio visualized without speaker playback.
                            </p>
                            {mics.length === 0 ? (
                                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-400">
                                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>No microphones found or permission denied.</span>
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedMic}
                                        onChange={e => setSelectedMic(e.target.value)}
                                        className={selectCls}
                                        aria-label="Microphone device"
                                    >
                                        {mics.map((m, i) => (
                                            <option key={m.deviceId} value={m.deviceId}>
                                                {m.label || `Microphone ${i}`}
                                            </option>
                                        ))}
                                    </select>

                                    {speakers.length > 0 && (
                                        <div>
                                            <label className="mb-1 block text-[10px] text-[var(--color-player-text-muted)]">
                                                Output speaker
                                            </label>
                                            <select
                                                value={micSpeakerId}
                                                onChange={e => setMicSpeakerId(e.target.value)}
                                                className={selectCls}
                                                aria-label="Speaker for mic mode"
                                            >
                                                <option value="">System default</option>
                                                {speakers.map((s, i) => (
                                                    <option key={s.deviceId} value={s.deviceId}>
                                                        {s.label || `Speaker ${i}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ── Screen capture ── */}
                    {tab === "screen" && (
                        <>
                            {!isScreenCaptureSupported() ? (
                                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-400">
                                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>
                                        Screen capture is not supported in this browser. Use Chrome, Edge, or
                                        Firefox.
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-[var(--color-player-text-muted)]">
                                        Share a screen, window, or tab. System audio and microphone are
                                        optional.
                                    </p>

                                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-player-text)]">
                                        <input
                                            type="checkbox"
                                            checked={screenSystemAudio}
                                            onChange={e => setScreenSystemAudio(e.target.checked)}
                                            className="accent-[var(--color-player-accent)]"
                                        />
                                        Include system audio
                                        <span className="text-[10px] text-[var(--color-player-text-muted)]">
                                            (browser/OS may override)
                                        </span>
                                    </label>

                                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-player-text)]">
                                        <input
                                            type="checkbox"
                                            checked={screenWithMic}
                                            onChange={e => setScreenWithMic(e.target.checked)}
                                            className="accent-[var(--color-player-accent)]"
                                        />
                                        Add microphone overlay
                                    </label>

                                    {screenWithMic && mics.length > 0 && (
                                        <select
                                            value={screenMicId}
                                            onChange={e => setScreenMicId(e.target.value)}
                                            className={selectCls}
                                            aria-label="Microphone overlay"
                                        >
                                            {mics.map((m, i) => (
                                                <option key={m.deviceId} value={m.deviceId}>
                                                    {m.label || `Microphone ${i}`}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {speakers.length > 0 && (
                                        <div>
                                            <label className="mb-1 block text-[10px] text-[var(--color-player-text-muted)]">
                                                Output speaker
                                            </label>
                                            <select
                                                value={screenSpeakerId}
                                                onChange={e => setScreenSpeakerId(e.target.value)}
                                                className={selectCls}
                                            >
                                                <option value="">System default</option>
                                                {speakers.map((s, i) => (
                                                    <option key={s.deviceId} value={s.deviceId}>
                                                        {s.label || `Speaker ${i}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {screenError && (
                                        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                            <span>{screenError}</span>
                                        </div>
                                    )}

                                    <p className="text-[10px] text-[var(--color-player-text-muted)]">
                                        Clicking "Select Screen & Add" opens the browser's screen picker.
                                    </p>
                                </>
                            )}
                        </>
                    )}

                    {/* ── Network Stream ── */}
                    {tab === "stream" && (
                        <>
                            <p className="text-xs text-[var(--color-player-text-muted)]">
                                Select a target profile or configure a custom transport.
                            </p>
                            <select
                                value={streamTargetId}
                                onChange={e => {
                                    const target = STREAM_TARGETS.find(t => t.id === e.target.value);
                                    setStreamTargetId(e.target.value);
                                    if (!target) return;
                                    setStreamProtocol(target.protocol);
                                    setStreamUrl(target.url ?? "");
                                    setStreamChannel(target.channel ?? "");
                                    setStreamSignalingUrl(target.signalingUrl ?? "");
                                    setStreamError(null);
                                }}
                                className={selectCls}
                            >
                                {STREAM_TARGETS.map(target => (
                                    <option key={target.id} value={target.id}>
                                        {target.name} · {target.protocol.toUpperCase()} · {target.role}
                                    </option>
                                ))}
                                <option value="custom">Custom</option>
                            </select>
                            <select
                                value={streamProtocol}
                                onChange={e => setStreamProtocol(e.target.value as StreamProtocol)}
                                className={selectCls}
                            >
                                <option value="http">HTTP</option>
                                <option value="https">HTTPS</option>
                                <option value="ws">WS (local)</option>
                                <option value="wss">WSS</option>
                                <option value="mqtts">MQTTS</option>
                                <option value="webrtc">WebRTC</option>
                                <option value="rtsp">RTSP</option>
                            </select>
                            <input
                                type="url"
                                autoFocus
                                placeholder="https://…/stream.m3u8 or wss://…"
                                value={streamUrl}
                                onChange={e => {
                                    setStreamUrl(e.target.value);
                                    setStreamError(null);
                                }}
                                onKeyDown={e => e.key === "Enter" && addStream()}
                                className={inputCls}
                            />
                            <input
                                type="text"
                                placeholder="Optional channel / topic / room"
                                value={streamChannel}
                                onChange={e => setStreamChannel(e.target.value)}
                                className={inputCls}
                            />
                            {streamProtocol === "webrtc" && (
                                <input
                                    type="url"
                                    placeholder="wss://… signaling URL"
                                    value={streamSignalingUrl}
                                    onChange={e => setStreamSignalingUrl(e.target.value)}
                                    className={inputCls}
                                />
                            )}
                            {streamError && (
                                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{streamError}</span>
                                </div>
                            )}
                            {streamProtocol !== "http" && streamProtocol !== "https" && (
                                <p className="text-[10px] text-[var(--color-player-text-muted)]">
                                    This protocol may require a relay/adapter. Browser inline playback may be
                                    unavailable, but stream metadata is still saved.
                                </p>
                            )}

                            {/* Desktop-only OpenCV launcher */}
                            {isTauri() && (
                                <div className="space-y-2 rounded-lg border border-[var(--color-player-border)] px-3 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-player-text-muted)]">
                                        Desktop OpenCV Capture
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <label className="text-xs text-[var(--color-player-text-muted)]">
                                            Device
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={10}
                                            value={cvDevice}
                                            onChange={e => setCvDevice(Number(e.target.value))}
                                            className="w-16 rounded border border-[var(--color-player-border)] bg-[var(--color-player-bg)] px-2 py-1 text-xs text-[var(--color-player-text)] outline-none"
                                        />
                                        <label className="text-xs text-[var(--color-player-text-muted)]">
                                            Port
                                        </label>
                                        <input
                                            type="number"
                                            min={1024}
                                            max={65535}
                                            value={cvPort}
                                            onChange={e => setCvPort(Number(e.target.value))}
                                            className="w-20 rounded border border-[var(--color-player-border)] bg-[var(--color-player-bg)] px-2 py-1 text-xs text-[var(--color-player-text)] outline-none"
                                        />
                                        <button
                                            onClick={handleLaunchOpenCv}
                                            disabled={cvLaunching}
                                            className="rounded bg-[var(--color-player-accent)] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                        >
                                            {cvLaunching ? "Launching…" : "Launch"}
                                        </button>
                                    </div>
                                    {cvError && <p className="text-[10px] text-red-400">{cvError}</p>}
                                    <p className="text-[10px] text-[var(--color-player-text-muted)]">
                                        Requires Python 3 + OpenCV. Runs{" "}
                                        <code className="font-mono">scripts/opencv_stream.py</code>.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-[var(--color-player-border)] px-5 py-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-1.5 text-sm text-[var(--color-player-text-muted)] transition-colors hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={
                            tab === "camera"
                                ? addCamera
                                : tab === "mic"
                                  ? addMic
                                  : tab === "screen"
                                    ? handleAddScreen
                                    : addStream
                        }
                        disabled={!canAdd}
                        className="rounded-lg bg-[var(--color-player-accent)] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {tab === "screen"
                            ? screenLaunching
                                ? "Selecting…"
                                : "Select Screen & Add"
                            : "Add to Playlist"}
                    </button>
                </div>
            </div>
        </>
    );
}
