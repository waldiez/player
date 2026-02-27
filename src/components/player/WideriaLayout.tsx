/**
 * WideriaLayout — full-page audio-visual layout for mood modes on large screens.
 *
 * Mirrors the structure of wideria/web/player.html:
 *   header  (brand + mode switcher)
 *   canvas  (MoodVisualizer, fills available space)
 *   transport (track info + scrubber + controls)
 *   bottom-grid (Studio: EQ/FX/Presets | Tracklist)
 */
import { useAudioChain } from "@/hooks/useAudioChain";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMediaStream } from "@/hooks/useMediaStream";
import { useMoodPersistence } from "@/hooks/useMoodPersistence";
import { useStreamAnalyser } from "@/hooks/useStreamAnalyser";
import { useTauriMpv } from "@/hooks/useTauriMpv";
import { readBeaconSettings, resolveActiveBeaconTarget } from "@/lib/beaconSettings";
import { type BeaconTransport, openBeaconTransport } from "@/lib/beaconTransport";
import {
    avConstraints,
    isAudioOutputSelectionSupported,
    isLocalMjpegStream,
    micConstraints,
    pendingStreams,
} from "@/lib/deviceSource";
import { extractYouTubeId } from "@/lib/mediaSource";
import {
    type MoodCustomization,
    exportPrefsAsWaldiez,
    exportPrefsAsWid,
    importPrefsFromFile,
    loadModeEqFx,
    loadMoodCustomizations,
    readPrefs,
    saveModeEqFxToPrefs,
} from "@/lib/moodDefaults";
import { STREAM_TARGETS, isBrowserPlayableStreamProtocol } from "@/lib/streamTargets";
import { isTauri, ytGetAudioUrl } from "@/lib/tauriPlayer";
import { cn } from "@/lib/utils";
import { nextWid } from "@/lib/wid";
import { usePlayerStore } from "@/stores";
import type { MediaFile } from "@/types";
import { EQ_PRESETS, MOOD_META } from "@/types/mood";
import type { AudioChainConfig, EQPresetName, MoodMode } from "@/types/mood";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    Camera,
    Disc2,
    Disc3,
    Download,
    Globe,
    GripVertical,
    Guitar,
    Headphones,
    Mic2,
    Monitor,
    Music,
    Music2,
    Orbit,
    Palette,
    Pause,
    Play,
    Radio,
    Repeat,
    Repeat1,
    SkipBack,
    SkipForward,
    Sliders,
    Sparkles,
    Star,
    Upload,
    Video,
    Volume1,
    Volume2,
    VolumeX,
    Wand2,
    X,
    Youtube,
    Zap,
} from "lucide-react";

import { AddDeviceDialog } from "./AddDeviceDialog";
import { AddSourceDialog } from "./AddSourceDialog";
import { MoodCustomizeDialog } from "./MoodCustomizeDialog";
import { MoodVisualizer } from "./MoodVisualizer";
import { YouTubeEmbed } from "./YouTubeEmbed";
import type { YouTubeEmbedHandle } from "./YouTubeEmbed";

// ── Mood mode header buttons ───────────────────────────────────────────────

const MOOD_BTNS = [
    { mode: "dock" as MoodMode, Icon: Disc3 },
    { mode: "storm" as MoodMode, Icon: Zap },
    { mode: "fest" as MoodMode, Icon: Sparkles },
    { mode: "journey" as MoodMode, Icon: Orbit },
    { mode: "rock" as MoodMode, Icon: Guitar },
    { mode: "pop" as MoodMode, Icon: Mic2 },
    { mode: "disco" as MoodMode, Icon: Disc2 },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(s: number): string {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Returns the preset name whose eq+fx exactly match the given chain, or "flat". */
function findPresetMatch(chain: AudioChainConfig): EQPresetName {
    for (const [name, preset] of Object.entries(EQ_PRESETS) as [
        EQPresetName,
        (typeof EQ_PRESETS)[EQPresetName],
    ][]) {
        const eq = chain.eq;
        const fx = chain.fx;
        if (
            preset.eq.bass === eq.bass &&
            preset.eq.mid === eq.mid &&
            preset.eq.treble === eq.treble &&
            preset.fx.reverb === fx.reverb &&
            preset.fx.echo === fx.echo &&
            preset.fx.fuzz === fx.fuzz &&
            preset.fx.vinyl === fx.vinyl
        )
            return name;
    }
    return "flat";
}

// ── Component ──────────────────────────────────────────────────────────────

interface WideriaLayoutProps {
    mode: MoodMode;
}

export function WideriaLayout({ mode }: WideriaLayoutProps) {
    // ── Audio chain ─────────────────────────────────────────────────────
    const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
    const isSeeking = useRef(false);
    const [showAddSource, setShowAddSource] = useState(false);
    const [showAddDevice, setShowAddDevice] = useState(false);

    // ── Store ────────────────────────────────────────────────────────────
    const {
        currentMedia,
        playback,
        playerModeConfig,
        setPlayback,
        seek,
        togglePlay,
        toggleMute,
        setVolume: storeSetVolume,
        mediaLibrary,
        setCurrentMedia,
        addToLibrary,
        removeFromLibrary,
        setPlayerMode,
        playNextInLibrary,
        playPrevInLibrary,
        repeatMode,
        cycleRepeatMode,
        reorderLibrary,
    } = usePlayerStore();

    // ── Video / visualizer toggle (YouTube only) ─────────────────────────
    // false = show YouTube iframe, true = hide iframe and show visualizer animation
    const [showVisualizer, setShowVisualizer] = useState(false);
    const ytEmbedRef = useRef<YouTubeEmbedHandle>(null);
    // Title reported by the YT player (overrides MediaFile.name while a YT track is playing)
    const [ytTrackTitle, setYtTrackTitle] = useState<string | null>(null);
    // Reset the title override whenever the library entry (playlist) changes
    useEffect(() => {
        setYtTrackTitle(null);
    }, [currentMedia?.id]);

    // ── Mood customization ────────────────────────────────────────────────
    const [showCustomize, setShowCustomize] = useState(false);
    const [customMeta, setCustomMeta] = useState<Partial<Record<MoodMode, MoodCustomization>>>(() =>
        loadMoodCustomizations(),
    );

    const reloadCustomMeta = useCallback(() => {
        setCustomMeta(loadMoodCustomizations());
    }, []);

    // Derived: resolved meta for the active mode (defaults ∪ user overrides)
    const activeMoodCustom = customMeta[mode];

    // Apply custom colours as CSS variables after App.tsx sets the mode theme
    useEffect(() => {
        const custom = customMeta[mode];
        if (!custom) return;
        const root = document.documentElement;
        if (custom.accent) {
            const r = parseInt(custom.accent.slice(1, 3), 16);
            const g = parseInt(custom.accent.slice(3, 5), 16);
            const b = parseInt(custom.accent.slice(5, 7), 16);
            root.style.setProperty("--color-player-accent", custom.accent);
            root.style.setProperty("--color-player-accent-hover", `rgba(${r},${g},${b},0.75)`);
            root.style.setProperty("--color-player-border", `rgba(${r},${g},${b},0.22)`);
        }
        if (custom.bg) {
            root.style.setProperty("--color-player-bg", custom.bg);
        }
    }, [mode, customMeta]);

    // Helper: label to show for a mood button (custom label or MOOD_META default)
    function getMoodLabel(m: MoodMode) {
        return customMeta[m]?.label ?? MOOD_META[m].label;
    }

    // ── Mood persistence (load defaults, auto-save, save-as-default) ─────
    const { saveAsDefault, reloadTracklist } = useMoodPersistence(mode);
    const [savedFlash, setSavedFlash] = useState(false);
    // Shown briefly after an export that skipped local-file tracks
    const [localFilesWarning, setLocalFilesWarning] = useState(false);
    const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "live">("idle");
    const [liveError, setLiveError] = useState<string | null>(null);

    // ── File input ref for prefs import ──────────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);
    const streamVideoRef = useRef<HTMLVideoElement>(null);
    const deviceStreamRef = useRef<MediaStream | null>(null);
    const beaconTransportRef = useRef<BeaconTransport | null>(null);
    const beaconIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const beaconDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Stable ref so beacon callbacks always see the latest state without stale closures
    const liveStateRef = useRef({ playback, currentMedia, ytTrackTitle });
    useEffect(() => {
        liveStateRef.current = { playback, currentMedia, ytTrackTitle };
    });
    const sessionIdRef = useRef("");

    function handleSaveAsDefault() {
        saveAsDefault();
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1800);
    }

    useEffect(() => {
        if (!liveError) return;
        const t = setTimeout(() => setLiveError(null), 6000);
        return () => clearTimeout(t);
    }, [liveError]);

    // ── Export / Import preferences (.wid format) ─────────────────────────
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

    async function handleImportPrefs(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so the same file can be re-imported if needed
        e.target.value = "";
        const ok = await importPrefsFromFile(file);
        if (ok) {
            reloadCustomMeta();
            // Restore volume/muted from imported prefs
            const imported = readPrefs();
            if (imported) {
                if (imported.volume !== undefined) storeSetVolume(imported.volume);
                if (imported.muted !== undefined && imported.muted) toggleMute();
                // Switch to saved mood mode if present
                if (imported.mode) setPlayerMode(imported.mode as MoodMode);
            }
            reloadTracklist();
        }
    }

    // ── Breakpoint helpers ───────────────────────────────────────────────
    // Used to decide volume-icon click behaviour (snap vs mute-toggle)
    const isSmallScreen = useMediaQuery("(max-width: 639px)");

    // ── Studio panel — togglable, default open only on xl screens ────────
    const isXL = useMediaQuery("(min-width: 1280px)");
    const [showStudio, setShowStudio] = useState(false); // resolved below
    // Sync with screen size on first render / resize (only if user hasn't toggled)
    const studioInitialised = useRef(false);
    useEffect(() => {
        if (!studioInitialised.current) {
            setShowStudio(isXL);
            studioInitialised.current = true;
        }
    }, [isXL]);

    // ── Drag-to-reorder state ────────────────────────────────────────────
    const dragSrcIndex = useRef<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Source type helpers — YouTube / Spotify use embeds; camera/mic/stream/screen use device APIs
    const src = currentMedia?.source ?? "file";
    const isYouTube = src === "youtube";
    const isSpotify = src === "spotify";
    const isCamera = src === "camera";
    const isMic = src === "microphone";
    const isStream = src === "stream";
    const isScreen = src === "screen";
    const audioDeviceId = currentMedia?.audioDeviceId;
    const streamProtocol =
        currentMedia?.streamProtocol ??
        (currentMedia?.path.startsWith("https://")
            ? "https"
            : currentMedia?.path.startsWith("http://")
              ? "http"
              : undefined);
    const canInlinePlayStream =
        isStream && !!streamProtocol && isBrowserPlayableStreamProtocol(streamProtocol);

    // ── Tauri desktop: use yt-dlp to get a direct CDN URL for YouTube ─────
    // This replaces the IFrame embed when running as a desktop app, giving us:
    //   • No ads  • Full Web Audio chain (EQ / FX / visualiser)  • native <audio>
    // Falls back to the IFrame if yt-dlp is unavailable or returns an error.
    const isTauriEnv = isTauri();
    const [tauriYtUrl, setTauriYtUrl] = useState<string | null>(null);
    const useTauriAudio = isTauriEnv && isYouTube && !!tauriYtUrl;

    const useAudio =
        useTauriAudio || (!isYouTube && !isSpotify && !isCamera && !isMic && !isStream && !isScreen);

    const { init, resume, applyChain, setVolume, analyser } = useAudioChain(useAudio ? audioEl : null);

    // ── Fetch yt-dlp CDN URL when track changes (Tauri only) ──────────────
    const ytId = currentMedia?.youtubeId ?? (currentMedia ? extractYouTubeId(currentMedia.path) : null);
    useEffect(() => {
        if (!isTauriEnv || !isYouTube || !ytId) {
            setTauriYtUrl(null);
            return;
        }
        let cancelled = false;
        setTauriYtUrl(null); // clear while fetching
        ytGetAudioUrl(ytId)
            .then(url => {
                if (!cancelled) setTauriYtUrl(url);
            })
            .catch(() => {
                if (!cancelled) setTauriYtUrl(null); /* fall back to IFrame */
            });
        return () => {
            cancelled = true;
        };
    }, [isTauriEnv, isYouTube, ytId]);

    // ── mpv backend: drive store from mpv IPC events ───────────────────────
    // useMpvAudio is currently false in WideriaLayout (yt-dlp + <audio> is the
    // primary Tauri path).  Set it to true to switch a track to mpv instead.
    useTauriMpv(false /* isMpvMode */, handleEnded);

    /** Build and publish a state beacon through the active transport. */
    function sendBeacon(type: "start" | "state" | "stop") {
        const transport = beaconTransportRef.current;
        if (!transport) return;
        const { playback: pb, currentMedia: cm, ytTrackTitle: title } = liveStateRef.current;
        transport.publish({
            type,
            session_id: sessionIdRef.current,
            source: cm?.source ?? "none",
            name: title ?? cm?.name ?? "",
            ...(cm?.youtubeId && { youtube_id: cm.youtubeId }),
            ...(cm?.playlistId && { playlist_id: cm.playlistId }),
            playing: pb.isPlaying,
            t: parseFloat(pb.currentTime.toFixed(1)),
            duration: parseFloat(pb.duration.toFixed(1)),
            volume: parseFloat(pb.volume.toFixed(2)),
            muted: pb.isMuted,
            rate: pb.playbackRate,
            ts: new Date().toISOString(),
        });
    }

    function stopLiveBeacon() {
        sendBeacon("stop");
        if (beaconIntervalRef.current) {
            clearInterval(beaconIntervalRef.current);
            beaconIntervalRef.current = null;
        }
        if (beaconDebounceRef.current) {
            clearTimeout(beaconDebounceRef.current);
            beaconDebounceRef.current = null;
        }
        beaconTransportRef.current?.disconnect();
        beaconTransportRef.current = null;
        setLiveStatus("idle");
    }

    function resolveBeaconTarget() {
        const path = currentMedia?.path ?? "";
        const proto = currentMedia?.streamProtocol;
        // Direct ws/wss URL embedded in the media entry
        if ((proto === "ws" || proto === "wss") && (path.startsWith("ws://") || path.startsWith("wss://"))) {
            return { url: path, protocol: proto as string };
        }
        // Named stream target embedded in the media file
        if (currentMedia?.streamTargetId) {
            const t = STREAM_TARGETS.find(s => s.id === currentMedia.streamTargetId);
            if (t?.url) return { url: t.url, protocol: t.protocol, channel: t.channel };
        }
        // Settings-configured preferred target
        const settings = readBeaconSettings();
        return resolveActiveBeaconTarget(STREAM_TARGETS, settings);
    }

    function startLiveBeacon() {
        setLiveError(null);
        if (liveStatus !== "idle") return;

        const targetInfo = resolveBeaconTarget();
        if (!targetInfo) {
            setLiveError("No beacon endpoint configured. Open Settings and select or add a target.");
            return;
        }

        // Mixed-content guard for plain ws:// on HTTPS pages
        if (location.protocol === "https:" && targetInfo.url.startsWith("ws://")) {
            setLiveError(
                `Mixed content blocked: page is HTTPS but endpoint is plain ws://. Use wss:// instead. (${targetInfo.url})`,
            );
            return;
        }

        const sessionWid = nextWid();
        sessionIdRef.current = sessionWid;
        console.log(
            "[beacon] connecting →",
            targetInfo.url,
            targetInfo.protocol === "mqtts"
                ? `topic: ${targetInfo.channel ?? "waldiez/player"}/${sessionWid}`
                : "",
        );
        setLiveStatus("connecting");

        try {
            const transport = openBeaconTransport(targetInfo, sessionWid, {
                onOpen() {
                    beaconTransportRef.current = transport;
                    sendBeacon("start");
                    beaconIntervalRef.current = setInterval(() => sendBeacon("state"), 5_000);
                    setLiveStatus("live");
                },
                onConnectError(msg) {
                    setLiveError(msg);
                    beaconTransportRef.current = null;
                    setLiveStatus("idle");
                },
                onClose(intentional, code) {
                    if (beaconIntervalRef.current) {
                        clearInterval(beaconIntervalRef.current);
                        beaconIntervalRef.current = null;
                    }
                    beaconTransportRef.current = null;
                    setLiveStatus("idle");
                    if (!intentional) {
                        setLiveError(
                            `Beacon dropped${code !== undefined ? ` (code ${code})` : ""}. Click Beacon to reconnect.`,
                        );
                    }
                },
            });
        } catch (error) {
            setLiveError(
                error instanceof Error ? `Beacon failed: ${error.message}` : "Couldn't open beacon.",
            );
            setLiveStatus("idle");
        }
    }

    // Cleanup on unmount
    useEffect(
        () => () => {
            if (beaconIntervalRef.current) clearInterval(beaconIntervalRef.current);
            if (beaconDebounceRef.current) clearTimeout(beaconDebounceRef.current);
            beaconTransportRef.current?.disconnect();
            beaconTransportRef.current = null;
        },
        [],
    );

    // Send a debounced beacon whenever playback state changes while live
    useEffect(() => {
        if (liveStatus !== "live") return;
        if (beaconDebounceRef.current) clearTimeout(beaconDebounceRef.current);
        beaconDebounceRef.current = setTimeout(() => sendBeacon("state"), 300);
        return () => {
            if (beaconDebounceRef.current) clearTimeout(beaconDebounceRef.current);
        };
    }, [
        liveStatus,
        playback.isPlaying,
        playback.currentTime,
        playback.volume,
        playback.isMuted,
        currentMedia?.id,
        ytTrackTitle,
    ]);

    // ── Device media stream (camera / microphone) ────────────────────────
    const { acquire: acquireStream, release: releaseStream } = useMediaStream();
    const {
        analyser: micAnalyser,
        connect: connectMicStream,
        disconnect: disconnectMicStream,
    } = useStreamAnalyser();
    const cameraVideoRef = useRef<HTMLVideoElement>(null);
    const screenVideoRef = useRef<HTMLVideoElement>(null);

    // Analyser to pass to the visualizer: mic/camera+mic/screen → micAnalyser, else audio-chain
    const hasDeviceAudio = isMic || (isCamera && !!audioDeviceId) || isScreen;
    const activeAnalyser = hasDeviceAudio ? micAnalyser : analyser;

    // ── Local chain state (EQ + FX) ─────────────────────────────────────
    const defaultPreset = MOOD_META[mode].defaultEQ;
    const [eq, setEqLocal] = useState<AudioChainConfig["eq"]>(() => {
        const saved = loadModeEqFx(mode);
        return saved ? saved.eq : EQ_PRESETS[defaultPreset].eq;
    });
    const [fx, setFxLocal] = useState<AudioChainConfig["fx"]>(() => {
        const saved = loadModeEqFx(mode);
        return saved ? saved.fx : EQ_PRESETS[defaultPreset].fx;
    });
    const [activePreset, setActivePreset] = useState<EQPresetName>(() => {
        const saved = loadModeEqFx(mode);
        return saved ? findPresetMatch(saved) : defaultPreset;
    });

    // Apply chain whenever EQ/FX change
    useEffect(() => {
        applyChain({ eq, fx });
    }, [eq, fx, applyChain]);

    // Debounced EQ/FX save
    const eqFxSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (eqFxSaveTimer.current) clearTimeout(eqFxSaveTimer.current);
        eqFxSaveTimer.current = setTimeout(() => {
            saveModeEqFxToPrefs(mode, eq, fx);
        }, 500);
        return () => {
            if (eqFxSaveTimer.current) clearTimeout(eqFxSaveTimer.current);
        };
    }, [mode, eq, fx]);

    // Load saved EQ/FX when mood mode changes
    useEffect(() => {
        const saved = loadModeEqFx(mode);
        if (saved) {
            setEqLocal(saved.eq);
            setFxLocal(saved.fx);
            setActivePreset(findPresetMatch(saved));
        } else {
            const name = MOOD_META[mode].defaultEQ;
            const preset = EQ_PRESETS[name];
            setEqLocal(preset.eq);
            setFxLocal(preset.fx);
            setActivePreset(name);
        }
    }, [mode]);

    // ── Audio element ↔ store sync (mirrors MoodPlayer) ─────────────────
    useEffect(() => {
        if (!audioEl || !useAudio) return;
        if (playback.isPlaying) {
            init();
            resume();
            audioEl.play().catch(() => {});
        } else audioEl.pause();
    }, [playback.isPlaying, audioEl, init, resume, useAudio]);

    useEffect(() => {
        setVolume(playback.isMuted ? 0 : playback.volume);
    }, [playback.volume, playback.isMuted, setVolume]);

    useEffect(() => {
        if (!audioEl || isSeeking.current) return;
        if (Math.abs(audioEl.currentTime - playback.currentTime) > 0.5) {
            audioEl.currentTime = playback.currentTime;
        }
    }, [playback.currentTime, audioEl]);

    useEffect(() => {
        if (audioEl) audioEl.playbackRate = playback.playbackRate;
    }, [playback.playbackRate, audioEl]);
    // "one" → native loop; "all"/"none" handled by handleEnded + playNextInLibrary
    useEffect(() => {
        if (audioEl) audioEl.loop = repeatMode === "one";
    }, [repeatMode, audioEl]);

    // Sync YouTube seek when the store resets currentTime to 0 without changing the
    // track (e.g. Spotify-style "restart" from playPrevInLibrary).
    const prevCurrentTimeRef = useRef(0);
    useEffect(() => {
        const prev = prevCurrentTimeRef.current;
        prevCurrentTimeRef.current = playback.currentTime;
        if (isYouTube && playback.currentTime === 0 && prev > 0.5) {
            ytEmbedRef.current?.seekTo(0);
        }
    }, [playback.currentTime, isYouTube]);

    // ── Device media stream lifecycle (camera / mic / screen) ─────────────
    useEffect(() => {
        const source = currentMedia?.source;
        const deviceId = currentMedia?.deviceId;
        const micId = currentMedia?.audioDeviceId;

        if (source === "camera") {
            let cancelled = false;
            acquireStream(
                avConstraints({
                    videoDeviceId: deviceId,
                    audioDeviceId: micId,
                    includeAudio: !!micId,
                    facingMode: currentMedia?.facingMode,
                    captureResolution: currentMedia?.captureResolution,
                    captureFrameRate: currentMedia?.captureFrameRate,
                }),
            ).then(s => {
                if (s && !cancelled && cameraVideoRef.current) {
                    deviceStreamRef.current = s;
                    cameraVideoRef.current.srcObject = s;
                    // If mic is included connect audio tracks to the analyser
                    if (micId && s.getAudioTracks().length > 0) connectMicStream(s);
                }
            });
            return () => {
                cancelled = true;
                deviceStreamRef.current = null;
                disconnectMicStream();
                releaseStream();
            };
        }

        if (source === "microphone") {
            let cancelled = false;
            acquireStream(micConstraints(deviceId)).then(s => {
                if (s && !cancelled) {
                    deviceStreamRef.current = s;
                    connectMicStream(s);
                }
            });
            return () => {
                cancelled = true;
                deviceStreamRef.current = null;
                disconnectMicStream();
                releaseStream();
            };
        }

        if (source === "screen") {
            const mediaId = currentMedia?.id;
            const stream = mediaId ? pendingStreams.get(mediaId) : undefined;
            if (stream && screenVideoRef.current) {
                screenVideoRef.current.srcObject = stream;
                if (stream.getAudioTracks().length > 0) connectMicStream(stream);
            }
            return () => {
                if (mediaId) {
                    const s = pendingStreams.get(mediaId);
                    if (s) {
                        s.getTracks().forEach(t => t.stop());
                        pendingStreams.delete(mediaId);
                    }
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
                if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
                disconnectMicStream();
            };
        }

        // Non-device source: release any lingering streams
        deviceStreamRef.current = null;
        releaseStream();
        disconnectMicStream();
        return undefined;
        // Stable callbacks, safe to omit from deps array
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMedia?.id, currentMedia?.source, currentMedia?.deviceId, currentMedia?.audioDeviceId]);

    // ── Speaker output routing (Chrome/Edge setSinkId) ───────────────────
    const sinkId = currentMedia?.sinkId;
    useEffect(() => {
        if (!sinkId || !isAudioOutputSelectionSupported()) return;
        type SinkEl = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
        [
            audioEl as SinkEl | null,
            cameraVideoRef.current as SinkEl | null,
            screenVideoRef.current as SinkEl | null,
        ].forEach(el => {
            el?.setSinkId?.(sinkId).catch(() => {});
        });
    }, [sinkId, audioEl]);

    // ── Helpers ──────────────────────────────────────────────────────────
    function applyPreset(name: EQPresetName) {
        const preset = EQ_PRESETS[name];
        setEqLocal(preset.eq);
        setFxLocal(preset.fx);
        setActivePreset(name);
    }

    function addFile(file: File) {
        const entry: MediaFile = {
            id: nextWid(),
            name: file.name,
            path: URL.createObjectURL(file),
            type: file.type.startsWith("video/") ? "video" : "audio",
            duration: 0,
            size: file.size,
            createdAt: new Date(),
        };
        addToLibrary(entry);
        setCurrentMedia(entry);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        Array.from(e.dataTransfer.files)
            .filter(f => f.type.startsWith("audio/") || f.type.startsWith("video/"))
            .forEach(addFile);
    }

    function browseFiles() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*,video/*";
        input.multiple = true;
        input.onchange = e => Array.from((e.target as HTMLInputElement).files ?? []).forEach(addFile);
        input.click();
    }

    function playTrack(item: MediaFile) {
        setCurrentMedia(item);
        setPlayback({ currentTime: 0, duration: 0, isPlaying: true });
    }

    // ── Derived ──────────────────────────────────────────────────────────
    const VolumeIcon =
        playback.isMuted || playback.volume === 0 ? VolumeX : playback.volume < 0.5 ? Volume1 : Volume2;
    const progressPct = playback.duration ? (playback.currentTime / playback.duration) * 100 : 0;

    // ytId is defined earlier (above the yt-dlp fetch effect); reused here.
    const ytPlaylistId = currentMedia?.playlistId ?? null;
    // In Tauri, the IFrame is replaced by <audio src={tauriYtUrl}> via the yt-dlp path.
    const showYouTubeEmbed = !useTauriAudio && isYouTube && (!!ytId || !!ytPlaylistId);

    function handleEnded() {
        if (repeatMode === "one") {
            // YouTube IFrame: seek back to start and resume.
            // Tauri yt-dlp path: the <audio> element's `loop` attribute handles repeat.
            if (isYouTube && !useTauriAudio) {
                ytEmbedRef.current?.seekTo(0);
                setPlayback({ isPlaying: true, currentTime: 0 });
            }
            return;
        }
        if (playerModeConfig.behavior.autoAdvance) playNextInLibrary();
        else setPlayback({ isPlaying: false, currentTime: 0 });
    }

    function sourceIcon(item: MediaFile) {
        const s = item.source ?? "file";
        if (s === "youtube") return <Youtube className="h-3 w-3 flex-shrink-0 text-red-400" />;
        if (s === "spotify") return <Headphones className="h-3 w-3 flex-shrink-0 text-green-400" />;
        if (s === "url") return <Globe className="h-3 w-3 flex-shrink-0 text-[var(--color-player-accent)]" />;
        if (s === "camera") return <Camera className="h-3 w-3 flex-shrink-0 text-blue-400" />;
        if (s === "microphone") return <Mic2 className="h-3 w-3 flex-shrink-0 text-purple-400" />;
        if (s === "stream") return <Radio className="h-3 w-3 flex-shrink-0 text-cyan-400" />;
        if (s === "screen") return <Monitor className="h-3 w-3 flex-shrink-0 text-orange-400" />;
        return item.type === "audio" ? (
            <Music2
                className={cn(
                    "h-3 w-3 flex-shrink-0",
                    item.id === currentMedia?.id
                        ? "text-[var(--color-player-accent)]"
                        : "text-[var(--color-player-text-muted)]",
                )}
            />
        ) : (
            <Video
                className={cn(
                    "h-3 w-3 flex-shrink-0",
                    item.id === currentMedia?.id
                        ? "text-[var(--color-player-accent)]"
                        : "text-[var(--color-player-text-muted)]",
                )}
            />
        );
    }

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full flex-col overflow-hidden bg-[var(--color-player-bg)] text-[var(--color-player-text)]">
            {/* Hidden audio element — only for local files / HTTP streams */}
            {useAudio && (
                <audio
                    ref={setAudioEl}
                    // Tauri: use the yt-dlp CDN URL so the Web Audio chain works.
                    // crossOrigin="anonymous" is required for createMediaElementSource.
                    src={useTauriAudio ? (tauriYtUrl ?? undefined) : currentMedia?.path}
                    crossOrigin={useTauriAudio ? "anonymous" : undefined}
                    onTimeUpdate={() => {
                        if (audioEl && !isSeeking.current) setPlayback({ currentTime: audioEl.currentTime });
                    }}
                    onLoadedMetadata={() => {
                        if (audioEl) setPlayback({ duration: audioEl.duration });
                    }}
                    onEnded={handleEnded}
                    onSeeking={() => {
                        isSeeking.current = true;
                    }}
                    onSeeked={() => {
                        isSeeking.current = false;
                        if (audioEl) setPlayback({ currentTime: audioEl.currentTime });
                    }}
                />
            )}

            {/* Hidden file input for prefs import (.wid preferred, .waldiez and .json accepted) */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".wid,.waldiez,.json"
                className="hidden"
                onChange={handleImportPrefs}
            />

            {/* Add-source dialog */}
            {showAddSource && <AddSourceDialog onClose={() => setShowAddSource(false)} />}

            {/* Add-device dialog */}
            {showAddDevice && <AddDeviceDialog onClose={() => setShowAddDevice(false)} />}

            {/* Mood customization dialog */}
            {showCustomize && (
                <MoodCustomizeDialog
                    initialMode={mode}
                    onClose={() => setShowCustomize(false)}
                    onSaved={reloadCustomMeta}
                />
            )}

            {/* ════════════════════ HEADER ════════════════════ */}
            <header className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-player-border)] bg-[var(--color-player-surface)] px-3 py-2 sm:px-6 sm:py-2.5">
                <button
                    onClick={() => setPlayerMode("standard")}
                    className="flex items-center gap-1.5 text-sm font-semibold tracking-wider transition-opacity hover:opacity-70"
                >
                    <span className="text-[var(--color-player-accent)]">Waldiez</span>
                    <span className="hidden text-[var(--color-player-text-muted)] sm:inline">·</span>
                    <span className="hidden text-[var(--color-player-text-muted)] sm:inline">Player</span>
                </button>

                <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Visualizer mode">
                    {MOOD_BTNS.map(({ mode: m, Icon }) => (
                        <button
                            key={m}
                            onClick={() => setPlayerMode(m)}
                            className={cn(
                                "flex flex-shrink-0 items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-all sm:gap-1.5 sm:px-3",
                                m === mode
                                    ? "bg-[var(--color-player-accent)] text-white"
                                    : "text-[var(--color-player-text-muted)] hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]",
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{getMoodLabel(m)}</span>
                        </button>
                    ))}

                    {/* Customise mood colours / name */}
                    <button
                        onClick={() => setShowCustomize(true)}
                        aria-label="Customize mood appearance"
                        title="Customize mood"
                        className="ml-1 rounded p-1.5 text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                    >
                        <Palette className="h-3.5 w-3.5" />
                    </button>
                </nav>
            </header>

            {/* ════════════════════ CANVAS ════════════════════ */}
            {/* On mobile with no active media, collapse the canvas so the
                tracklist gets the space instead of an empty ♫ placeholder. */}
            <div
                className={cn(
                    "relative",
                    !currentMedia ? "h-28 shrink-0 sm:min-h-[100px] sm:flex-1" : "min-h-[100px] flex-1",
                )}
            >
                {/* Camera live feed — always muted (echo prevention even with combined mic) */}
                {isCamera && (
                    <video
                        ref={cameraVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full object-contain bg-black"
                    />
                )}

                {/* Screen capture — NOT muted so system audio plays through */}
                {isScreen && (
                    <video
                        ref={screenVideoRef}
                        autoPlay
                        playsInline
                        className="absolute inset-0 h-full w-full object-contain bg-black"
                    />
                )}

                {/* Network stream — MJPEG (<img>) for local streams, <video> for others */}
                {isStream &&
                    currentMedia &&
                    canInlinePlayStream &&
                    (isLocalMjpegStream(currentMedia.path) ? (
                        <img
                            src={currentMedia.path}
                            alt={currentMedia.name}
                            className="absolute inset-0 h-full w-full object-contain bg-black"
                        />
                    ) : (
                        <video
                            ref={streamVideoRef}
                            src={currentMedia.path}
                            autoPlay
                            playsInline
                            controls
                            className="absolute inset-0 h-full w-full object-contain bg-black"
                        />
                    ))}
                {isStream && currentMedia && !canInlinePlayStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-6 text-center">
                        <div className="max-w-xl rounded-lg border border-[var(--color-player-border)] bg-[var(--color-player-surface)] px-4 py-4">
                            <p className="text-sm font-medium text-[var(--color-player-text)]">
                                Stream route configured
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-player-text-muted)]">
                                Protocol {currentMedia.streamProtocol?.toUpperCase() ?? "custom"} cannot be
                                previewed inline in this browser path.
                            </p>
                            {currentMedia.streamChannel && (
                                <p className="mt-1 text-xs text-[var(--color-player-text-muted)]">
                                    Channel: {currentMedia.streamChannel}
                                </p>
                            )}
                            {currentMedia.signalingUrl && (
                                <p className="mt-1 text-xs text-[var(--color-player-text-muted)]">
                                    Signaling: {currentMedia.signalingUrl}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* YouTube iframe — kept in DOM when visualizer is shown (preserves audio) */}
                {showYouTubeEmbed && (
                    <YouTubeEmbed
                        ref={ytEmbedRef}
                        videoId={ytId ?? ""}
                        playlistId={ytPlaylistId ?? undefined}
                        isPlaying={playback.isPlaying}
                        volume={playback.volume}
                        isMuted={playback.isMuted}
                        playbackRate={playback.playbackRate}
                        onStateChange={playing => setPlayback({ isPlaying: playing })}
                        onTimeUpdate={(time, dur) => setPlayback({ currentTime: time, duration: dur })}
                        onVolumeChange={(vol, muted) => setPlayback({ volume: vol, isMuted: muted })}
                        onVideoChange={title => setYtTrackTitle(title)}
                        onEnded={handleEnded}
                        initialTime={playback.currentTime}
                        className={cn(
                            "absolute inset-0 h-full w-full transition-opacity duration-300",
                            showVisualizer && "opacity-0 pointer-events-none",
                        )}
                    />
                )}

                {/* Spotify embed */}
                {isSpotify && currentMedia?.embedUrl && (
                    <iframe
                        src={currentMedia.embedUrl}
                        title="Spotify player"
                        className="absolute inset-0 h-full w-full rounded"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                    />
                )}

                {/* MoodVisualizer — shown for audio/mic sources, or when YouTube video is hidden */}
                {(!isYouTube || showVisualizer) &&
                    !isSpotify &&
                    !isCamera &&
                    !isScreen &&
                    !isStream &&
                    (!currentMedia ? (
                        <div className="flex h-full items-center justify-center text-[var(--color-player-text-muted)]">
                            <div className="text-center">
                                <div className="mb-4 text-5xl opacity-20">♫</div>
                                <p className="text-lg">No audio loaded</p>
                                <p className="mt-2 text-sm opacity-60">
                                    Drop a file, add a URL, or connect a device
                                </p>
                            </div>
                        </div>
                    ) : (
                        <MoodVisualizer
                            mode={mode}
                            analyser={activeAnalyser}
                            isPlaying={playback.isPlaying}
                            accentOverride={activeMoodCustom?.accent}
                            bgOverride={activeMoodCustom?.bg}
                        />
                    ))}
            </div>

            {/* ════════════════════ TRANSPORT ════════════════════ */}
            <section
                className="flex-shrink-0 border-t border-[var(--color-player-border)] bg-[var(--color-player-surface)] px-3 py-2 sm:px-6 sm:py-3"
                aria-label="Playback controls"
            >
                {/* Track info */}
                <div className="mb-2 text-center">
                    <p className="truncate text-sm font-medium">
                        {ytTrackTitle ?? currentMedia?.name ?? "No Track Loaded"}
                    </p>
                    <p className="text-xs text-[var(--color-player-text-muted)]">
                        {currentMedia
                            ? `${mediaLibrary.length} track${mediaLibrary.length !== 1 ? "s" : ""} in playlist`
                            : "Drop audio files or click Browse to begin"}
                    </p>
                </div>

                {/* Scrubber */}
                <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
                    <span className="w-9 text-right text-xs tabular-nums text-[var(--color-player-text-muted)]">
                        {fmt(playback.currentTime)}
                    </span>
                    <div
                        role="slider"
                        aria-label="Seek"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progressPct)}
                        tabIndex={0}
                        className="relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-[var(--color-player-border)]"
                        onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const time = ((e.clientX - rect.left) / rect.width) * playback.duration;
                            seek(time);
                            if (isYouTube && !useTauriAudio) ytEmbedRef.current?.seekTo(time);
                        }}
                        onKeyDown={e => {
                            if (e.key === "ArrowLeft") {
                                const time = Math.max(0, playback.currentTime - 5);
                                seek(time);
                                if (isYouTube && !useTauriAudio) ytEmbedRef.current?.seekTo(time);
                            }
                            if (e.key === "ArrowRight") {
                                const time = Math.min(playback.duration, playback.currentTime + 5);
                                seek(time);
                                if (isYouTube && !useTauriAudio) ytEmbedRef.current?.seekTo(time);
                            }
                        }}
                    >
                        <div
                            className="absolute left-0 top-0 h-full rounded-full bg-[var(--color-player-accent)] transition-none"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <span className="w-9 text-xs tabular-nums text-[var(--color-player-text-muted)]">
                        {fmt(playback.duration)}
                    </span>
                </div>

                {/* Controls row */}
                <div className="flex items-center justify-center gap-3 sm:gap-6">
                    {/* Volume — slider hidden on mobile, mute icon always visible.
                          Mobile: icon snaps between 0 ↔ 1 (no mid-level dimming).
                          Desktop: icon toggles mute flag, slider adjusts level. */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => {
                                if (isSmallScreen) {
                                    // Snap: silent → full; audible → silent
                                    storeSetVolume(playback.isMuted || playback.volume === 0 ? 1 : 0);
                                } else {
                                    toggleMute();
                                }
                            }}
                            className="rounded p-1 text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                            aria-label={playback.isMuted || playback.volume === 0 ? "Unmute" : "Mute"}
                        >
                            <VolumeIcon className="h-4 w-4" />
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={playback.isMuted ? 0 : playback.volume}
                            onChange={e => storeSetVolume(Number(e.target.value))}
                            className="vol-slider hidden w-20 sm:block"
                            aria-label="Volume"
                        />
                    </div>

                    {/* Prev / Play / Next */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={playPrevInLibrary}
                            className="rounded-full p-1.5 text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                            aria-label="Previous track"
                        >
                            <SkipBack className="h-5 w-5" />
                        </button>

                        <button
                            onClick={togglePlay}
                            disabled={!currentMedia}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-player-accent)] text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
                            aria-label={playback.isPlaying ? "Pause" : "Play"}
                        >
                            {playback.isPlaying ? (
                                <Pause className="h-5 w-5" fill="white" />
                            ) : (
                                <Play className="h-5 w-5" fill="white" style={{ marginLeft: 2 }} />
                            )}
                        </button>

                        <button
                            onClick={playNextInLibrary}
                            className="rounded-full p-1.5 text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                            aria-label="Next track"
                        >
                            <SkipForward className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Repeat mode: none → all → one → none */}
                    <button
                        onClick={cycleRepeatMode}
                        aria-label={`Repeat: ${repeatMode}`}
                        title={
                            repeatMode === "none"
                                ? "Repeat off"
                                : repeatMode === "all"
                                  ? "Repeat all"
                                  : "Repeat one"
                        }
                        className={cn(
                            "rounded p-1.5 transition-colors",
                            repeatMode !== "none"
                                ? "text-[var(--color-player-accent)]"
                                : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                        )}
                    >
                        {repeatMode === "one" ? (
                            <Repeat1 className="h-4 w-4" />
                        ) : (
                            <Repeat className="h-4 w-4" />
                        )}
                    </button>

                    {/* Video / Visualizer toggle — only visible for YouTube tracks */}
                    {isYouTube && (
                        <button
                            onClick={() => setShowVisualizer(v => !v)}
                            aria-pressed={showVisualizer}
                            aria-label={showVisualizer ? "Show video" : "Show animation"}
                            title={showVisualizer ? "Show video" : "Show animation"}
                            className={cn(
                                "rounded p-1.5 transition-colors",
                                showVisualizer
                                    ? "text-[var(--color-player-accent)]"
                                    : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                            )}
                        >
                            {showVisualizer ? <Video className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                        </button>
                    )}
                </div>
            </section>

            {/* ════════════════════ BOTTOM GRID ════════════════════ */}
            <div
                className={cn(
                    !currentMedia
                        ? "grid flex-1 overflow-hidden border-t border-[var(--color-player-border)] min-h-[56px] sm:flex-none sm:shrink sm:max-h-56"
                        : "grid max-h-40 shrink border-t border-[var(--color-player-border)] min-h-[56px] sm:max-h-56",
                    showStudio ? "grid-cols-[268px_1fr]" : "grid-cols-[1fr]",
                )}
            >
                {/* ── Studio Panel ── */}
                {showStudio && (
                    <aside
                        className="flex flex-col gap-3 overflow-y-auto border-r border-[var(--color-player-border)] bg-[var(--color-player-surface)] px-4 py-3"
                        aria-label="Studio controls"
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-player-text-muted)]">
                            Studio
                        </p>

                        {/* EQ faders */}
                        <div>
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-player-text-muted)]">
                                EQ
                            </p>
                            <div className="flex justify-around">
                                {(["bass", "mid", "treble"] as const).map(band => (
                                    <div key={band} className="flex flex-col items-center gap-1">
                                        <span className="w-8 text-center text-xs tabular-nums text-[var(--color-player-text)]">
                                            {eq[band] > 0 ? `+${eq[band]}` : eq[band]}
                                        </span>
                                        <input
                                            type="range"
                                            min={-12}
                                            max={12}
                                            step={0.5}
                                            value={eq[band]}
                                            onChange={e => {
                                                setEqLocal(prev => ({
                                                    ...prev,
                                                    [band]: Number(e.target.value),
                                                }));
                                                setActivePreset("flat");
                                            }}
                                            className="eq-fader-vertical"
                                            aria-label={`${band} EQ`}
                                        />
                                        <span className="text-[10px] capitalize text-[var(--color-player-text-muted)]">
                                            {band}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FX toggles */}
                        <div>
                            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-player-text-muted)]">
                                FX
                            </p>
                            <div className="grid grid-cols-4 gap-1">
                                {(["reverb", "echo", "fuzz", "vinyl"] as const).map(effect => (
                                    <button
                                        key={effect}
                                        onClick={() =>
                                            setFxLocal(prev => ({ ...prev, [effect]: !prev[effect] }))
                                        }
                                        aria-pressed={fx[effect]}
                                        className={cn(
                                            "rounded px-1.5 py-1 text-[10px] font-medium capitalize transition-all",
                                            fx[effect]
                                                ? "bg-[var(--color-player-accent)] text-white"
                                                : "border border-[var(--color-player-border)] text-[var(--color-player-text-muted)] hover:border-[var(--color-player-accent)] hover:text-[var(--color-player-text)]",
                                        )}
                                    >
                                        {effect}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Presets */}
                        <div>
                            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-player-text-muted)]">
                                Presets
                            </p>
                            <div className="grid grid-cols-3 gap-1">
                                {(Object.keys(EQ_PRESETS) as EQPresetName[]).map(name => (
                                    <button
                                        key={name}
                                        onClick={() => applyPreset(name)}
                                        className={cn(
                                            "rounded px-2 py-1 text-[10px] capitalize transition-all",
                                            activePreset === name
                                                ? "bg-[color-mix(in_srgb,var(--color-player-accent)_20%,transparent)] text-[var(--color-player-accent)]"
                                                : "text-[var(--color-player-text-muted)] hover:bg-[var(--color-player-border)] hover:text-[var(--color-player-text)]",
                                        )}
                                    >
                                        {EQ_PRESETS[name].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>
                )}

                {/* ── Tracklist ── */}
                <div
                    className="flex flex-col overflow-hidden bg-[var(--color-player-bg)]"
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                >
                    {/* Tracklist header */}
                    <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-player-border)] px-3 py-2 sm:px-4">
                        <div className="flex items-center gap-2">
                            {/* Studio toggle */}
                            <button
                                onClick={() => setShowStudio(s => !s)}
                                aria-pressed={showStudio}
                                aria-label="Toggle studio panel"
                                className={cn(
                                    "rounded p-1 transition-colors",
                                    showStudio
                                        ? "text-[var(--color-player-accent)]"
                                        : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                                )}
                            >
                                <Sliders className="h-3 w-3" />
                            </button>

                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-player-text-muted)]">
                                Tracklist
                            </p>
                            <span className="rounded-full bg-[var(--color-player-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-player-text-muted)]">
                                {mediaLibrary.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            {/* Save as default */}
                            <button
                                onClick={handleSaveAsDefault}
                                disabled={mediaLibrary.length === 0}
                                className={cn(
                                    "flex items-center gap-1 text-[10px] transition-colors disabled:opacity-30",
                                    savedFlash
                                        ? "text-[var(--color-player-accent)]"
                                        : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                                )}
                                title="Save current playlist as default for this mode"
                            >
                                <Star className={cn("h-3 w-3", savedFlash && "fill-current")} />
                                <span className="hidden sm:inline">{savedFlash ? "Saved!" : "Default"}</span>
                            </button>

                            {/* Export / Import preferences (.wid) */}
                            <button
                                onClick={handleExportPrefs}
                                className={cn(
                                    "flex items-center gap-1 text-[10px] transition-colors",
                                    localFilesWarning
                                        ? "text-amber-400"
                                        : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                                )}
                                title={
                                    localFilesWarning
                                        ? "Local files excluded — only cloud tracks are saved in .wid"
                                        : "Export preferences as .wid"
                                }
                                aria-label="Export preferences"
                            >
                                <Download className="h-3 w-3" />
                                <span className="hidden sm:inline">
                                    {localFilesWarning ? "Local files excluded!" : "Export"}
                                </span>
                            </button>
                            <button
                                onClick={handleExportBundle}
                                className={cn(
                                    "flex items-center gap-1 text-[10px] transition-colors",
                                    localFilesWarning
                                        ? "text-amber-400"
                                        : "text-[var(--color-player-text-muted)] hover:text-[var(--color-player-text)]",
                                )}
                                title="Export bundle as .waldiez (zip with MANIFEST + .tic)"
                                aria-label="Export bundle"
                            >
                                <Download className="h-3 w-3" />
                                <span className="hidden sm:inline">Bundle</span>
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1 text-[10px] text-[var(--color-player-text-muted)] transition-colors hover:text-[var(--color-player-text)]"
                                title="Import preferences from .wid, .waldiez, or .json"
                                aria-label="Import preferences"
                            >
                                <Upload className="h-3 w-3" />
                                <span className="hidden sm:inline">Import</span>
                            </button>
                            {liveStatus === "live" ? (
                                <button
                                    onClick={stopLiveBeacon}
                                    className="flex items-center gap-1 text-[10px] text-red-400 transition-colors hover:text-red-300"
                                    title="Stop state beacon"
                                >
                                    <Radio className="h-3 w-3" />
                                    <span className="hidden sm:inline">Stop Beacon</span>
                                </button>
                            ) : (
                                <button
                                    onClick={startLiveBeacon}
                                    disabled={liveStatus === "connecting"}
                                    className="flex items-center gap-1 text-[10px] text-[var(--color-player-accent)] transition-colors hover:opacity-80 disabled:opacity-40"
                                    title="Broadcast player state over WSS"
                                >
                                    <Radio className="h-3 w-3" />
                                    <span className="hidden sm:inline">
                                        {liveStatus === "connecting" ? "Connecting…" : "Beacon"}
                                    </span>
                                </button>
                            )}

                            <button
                                onClick={() => setShowAddSource(true)}
                                className="flex items-center gap-1 text-xs text-[var(--color-player-accent)] transition-colors hover:opacity-70"
                                title="Add URL (YouTube, Spotify, stream)"
                            >
                                <Globe className="h-3 w-3" />
                                <span className="hidden sm:inline">URL</span>
                            </button>
                            <button
                                onClick={() => setShowAddDevice(true)}
                                className="flex items-center gap-1 text-xs text-[var(--color-player-accent)] transition-colors hover:opacity-70"
                                title="Add device (camera, microphone, network stream)"
                            >
                                <Camera className="h-3 w-3" />
                                <span className="hidden sm:inline">Device</span>
                            </button>
                            <button
                                onClick={browseFiles}
                                className="text-xs text-[var(--color-player-accent)] transition-colors hover:opacity-70"
                            >
                                <span className="hidden sm:inline">+ </span>Browse
                            </button>
                        </div>
                    </div>
                    {(liveStatus === "live" || liveError) && (
                        <div className="mt-1 px-1 text-[10px]">
                            {liveStatus === "live" && (
                                <p className="text-emerald-400">
                                    Broadcasting state beacon — heartbeat every 5 s, instant on change.
                                </p>
                            )}
                            {liveError && <p className="text-red-400">{liveError}</p>}
                        </div>
                    )}

                    {/* Track list */}
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        {mediaLibrary.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <Music className="mb-2 h-7 w-7 opacity-10 text-[var(--color-player-text)]" />
                                <p className="text-xs text-[var(--color-player-text-muted)]">
                                    Drop files or add a URL
                                </p>
                                <p className="mt-0.5 text-[10px] opacity-50 text-[var(--color-player-text-muted)]">
                                    mp3 · wav · YouTube · Spotify · camera · mic
                                </p>
                            </div>
                        ) : (
                            <ul>
                                {mediaLibrary.map((item, idx) => {
                                    const isCurrent = currentMedia?.id === item.id;
                                    const isPlaying = isCurrent && playback.isPlaying;
                                    const isDragOver = dragOverIndex === idx;
                                    return (
                                        <li
                                            key={item.id}
                                            draggable
                                            onDragStart={() => {
                                                dragSrcIndex.current = idx;
                                            }}
                                            onDragOver={e => {
                                                e.preventDefault();
                                                if (dragSrcIndex.current !== idx) setDragOverIndex(idx);
                                            }}
                                            onDrop={e => {
                                                e.preventDefault();
                                                if (
                                                    dragSrcIndex.current !== null &&
                                                    dragSrcIndex.current !== idx
                                                ) {
                                                    reorderLibrary(dragSrcIndex.current, idx);
                                                }
                                                dragSrcIndex.current = null;
                                                setDragOverIndex(null);
                                            }}
                                            onDragEnd={() => {
                                                dragSrcIndex.current = null;
                                                setDragOverIndex(null);
                                            }}
                                            className={cn(
                                                isDragOver &&
                                                    "border-t-2 border-[var(--color-player-accent)]",
                                            )}
                                        >
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => playTrack(item)}
                                                onKeyDown={e => e.key === "Enter" && playTrack(item)}
                                                className={cn(
                                                    "group flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors sm:px-4",
                                                    "hover:bg-[var(--color-player-border)]",
                                                    isCurrent &&
                                                        "bg-[color-mix(in_srgb,var(--color-player-accent)_10%,transparent)]",
                                                )}
                                            >
                                                {/* Drag handle */}
                                                <GripVertical className="h-3 w-3 flex-shrink-0 cursor-grab text-[var(--color-player-text-muted)] opacity-0 transition-opacity group-hover:opacity-40 active:cursor-grabbing" />

                                                <span className="w-4 flex-shrink-0 text-center text-[10px] tabular-nums text-[var(--color-player-text-muted)]">
                                                    {isPlaying ? (
                                                        <span className="text-[var(--color-player-accent)]">
                                                            ▶
                                                        </span>
                                                    ) : (
                                                        idx + 1
                                                    )}
                                                </span>

                                                {sourceIcon(item)}

                                                <span
                                                    className={cn(
                                                        "min-w-0 flex-1 truncate text-xs",
                                                        isCurrent
                                                            ? "font-medium text-[var(--color-player-accent)]"
                                                            : "text-[var(--color-player-text)]",
                                                    )}
                                                >
                                                    {item.name}
                                                </span>

                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        removeFromLibrary(item.id);
                                                    }}
                                                    className="flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-50 hover:!opacity-100 hover:text-red-400"
                                                    aria-label={`Remove ${item.name}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
