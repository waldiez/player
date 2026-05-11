/**
 * Manages a single DJ deck: source loading, Web Audio chain, transport, cue, loop, tap-BPM.
 * Designed to be used twice in DJView — one instance per deck.
 *
 * Two source modes:
 *   audio  — local file or Piped stream URL → hidden <audio> + Web Audio chain + analyser
 *   youtube — YouTube IFrame embed (Piped unavailable) → volume controlled via effectiveVolume prop
 *
 * The caller owns the <audio> element and passes its ref here; this keeps the ref out of
 * the returned DeckState object so ESLint's react-hooks/refs rule stays happy.
 */
import { extractYouTubeId } from "@/lib/mediaSource";
import { getPipedAudioUrl } from "@/lib/pipedPlayer";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DeckState {
    sourceInput: string;
    setSourceInput: (v: string) => void;
    loadSource: () => Promise<void>;
    loadFile: (file: File) => void;
    title: string;
    isLoading: boolean;

    // Audio element mode
    audioSrc: string | null;
    isCrossOrigin: boolean;
    onTimeUpdate: () => void;
    onLoadedMetadata: () => void;
    onEnded: () => void;

    // YouTube iframe fallback mode
    ytVideoId: string | null;
    /** Volume already multiplied by crossGain — pass directly to YouTubeEmbed */
    effectiveVolume: number;

    isPlaying: boolean;
    togglePlay: () => void;
    currentTime: number;
    duration: number;
    seek: (t: number) => void;

    volume: number;
    setVolume: (v: number) => void;
    pitch: number;
    setPitch: (v: number) => void;

    cuePoint: number | null;
    setCue: () => void;
    jumpToCue: () => void;

    loopEnabled: boolean;
    toggleLoop: () => void;

    bpm: number | null;
    tapBpm: () => void;

    analyser: AnalyserNode | null;
    setCrossGain: (gain: number) => void;
    setPlaying: (v: boolean) => void;
}

export function useDeck(audioElRef: React.RefObject<HTMLAudioElement | null>): DeckState {
    const [sourceInput, setSourceInput] = useState("");
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [isCrossOrigin, setIsCrossOrigin] = useState(false);
    const [ytVideoId, setYtVideoId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [volume, setVolumeState] = useState(0.8);
    const [effectiveVolume, setEffectiveVolume] = useState(0.8);
    const [pitch, setPitchState] = useState(1.0);
    const [cuePoint, setCuePointState] = useState<number | null>(null);
    const [loopEnabled, setLoopEnabledState] = useState(false);
    const [bpm, setBpm] = useState<number | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

    const gainNodeRef = useRef<GainNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const chainInitRef = useRef(false);
    const crossGainRef = useRef(1);
    const volumeRef = useRef(0.8);
    const pitchRef = useRef(1.0);
    const loopRef = useRef(false);
    const blobUrlRef = useRef<string | null>(null);
    const tapTimesRef = useRef<number[]>([]);

    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);
    useEffect(() => {
        pitchRef.current = pitch;
    }, [pitch]);
    useEffect(() => {
        loopRef.current = loopEnabled;
    }, [loopEnabled]);

    function initChain(el: HTMLAudioElement) {
        if (chainInitRef.current) return;
        chainInitRef.current = true;
        const ctx = new AudioContext();
        const src = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        gain.gain.value = volumeRef.current * crossGainRef.current;
        const analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.8;
        src.connect(gain);
        gain.connect(analyserNode);
        analyserNode.connect(ctx.destination);
        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
        setAnalyser(analyserNode);
    }

    function resetPlayState() {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setCuePointState(null);
    }

    function clearSource() {
        setAudioSrc(null);
        setIsCrossOrigin(false);
        setYtVideoId(null);
    }

    async function loadSource() {
        const url = sourceInput.trim();
        if (!url) return;
        setIsLoading(true);
        clearSource();
        try {
            const ytId = extractYouTubeId(url);
            if (ytId) {
                const pipedUrl = await getPipedAudioUrl(ytId);
                if (pipedUrl) {
                    setAudioSrc(pipedUrl);
                    setIsCrossOrigin(true);
                    setTitle(`YouTube · ${ytId}`);
                } else {
                    // Piped unavailable — fall back to YouTube iframe embed
                    setYtVideoId(ytId);
                    setTitle(`YouTube · ${ytId}`);
                }
            } else {
                setAudioSrc(url);
                setIsCrossOrigin(false);
                setTitle(url.split("/").pop() ?? url);
            }
        } finally {
            setIsLoading(false);
        }
        resetPlayState();
    }

    function loadFile(file: File) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(file);
        blobUrlRef.current = url;
        clearSource();
        setAudioSrc(url);
        setIsCrossOrigin(false);
        setSourceInput(file.name);
        setTitle(file.name);
        resetPlayState();
    }

    function togglePlay() {
        if (ytVideoId) {
            // YouTube iframe mode — just toggle state; YouTubeEmbed reacts to isPlaying prop
            setIsPlaying(p => !p);
            return;
        }
        const el = audioElRef.current;
        if (!el || !audioSrc) return;
        if (isPlaying) {
            el.pause();
            setIsPlaying(false);
        } else {
            initChain(el);
            audioCtxRef.current?.resume().catch(() => {});
            el.play().catch(() => {});
            setIsPlaying(true);
        }
    }

    function seek(t: number) {
        setCurrentTime(t);
        const el = audioElRef.current;
        if (el) el.currentTime = t;
    }

    function setVolume(v: number) {
        setVolumeState(v);
        volumeRef.current = v;
        const eff = v * crossGainRef.current;
        if (gainNodeRef.current) gainNodeRef.current.gain.value = eff;
        else if (audioElRef.current) audioElRef.current.volume = eff;
        setEffectiveVolume(eff);
    }

    function setPitch(p: number) {
        setPitchState(p);
        pitchRef.current = p;
        if (audioElRef.current) audioElRef.current.playbackRate = p;
    }

    const setCrossGain = useCallback(
        (gain: number) => {
            crossGainRef.current = gain;
            const eff = volumeRef.current * gain;
            if (gainNodeRef.current) gainNodeRef.current.gain.value = eff;
            else if (audioElRef.current) audioElRef.current.volume = eff;
            setEffectiveVolume(eff);
        },
        [audioElRef],
    );

    function setCue() {
        const t = audioElRef.current?.currentTime ?? currentTime;
        setCuePointState(t);
    }

    function jumpToCue() {
        if (cuePoint === null) return;
        seek(cuePoint);
    }

    function toggleLoop() {
        setLoopEnabledState(prev => {
            const next = !prev;
            loopRef.current = next;
            if (audioElRef.current) audioElRef.current.loop = next;
            return next;
        });
    }

    function tapBpm() {
        const now = performance.now();
        const taps = tapTimesRef.current;
        if (taps.length > 0 && now - taps[taps.length - 1] > 3000) {
            tapTimesRef.current = [now];
            return;
        }
        tapTimesRef.current.push(now);
        if (tapTimesRef.current.length >= 2) {
            const intervals: number[] = [];
            for (let i = 1; i < tapTimesRef.current.length; i++) {
                intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
            }
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            setBpm(Math.round(60000 / avg));
        }
    }

    const onTimeUpdate = useCallback(() => {
        const el = audioElRef.current;
        if (el) setCurrentTime(el.currentTime);
    }, [audioElRef]);

    const onLoadedMetadata = useCallback(() => {
        const el = audioElRef.current;
        if (!el) return;
        setDuration(el.duration);
        el.loop = loopRef.current;
        el.playbackRate = pitchRef.current;
    }, [audioElRef]);

    const onEnded = useCallback(() => {
        setIsPlaying(false);
    }, []);

    return {
        sourceInput,
        setSourceInput,
        loadSource,
        loadFile,
        title,
        isLoading,
        audioSrc,
        isCrossOrigin,
        onTimeUpdate,
        onLoadedMetadata,
        onEnded,
        ytVideoId,
        effectiveVolume,
        isPlaying,
        togglePlay,
        currentTime,
        duration,
        seek,
        volume,
        setVolume,
        pitch,
        setPitch,
        cuePoint,
        setCue,
        jumpToCue,
        loopEnabled,
        toggleLoop,
        bpm,
        tapBpm,
        analyser,
        setCrossGain,
        setPlaying: setIsPlaying,
    };
}
