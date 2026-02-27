/**
 * Web Audio chain: 3-band EQ + reverb / echo / fuzz / vinyl.
 * Lazy-initialised on first call to `init()`.
 * Ported from WIderia Player (kideria/web/player.js).
 */
import { useCallback, useRef, useState } from "react";

import type { AudioChainConfig } from "../types/mood";

// ── DSP helpers ────────────────────────────────────────────────────────────

function distCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 256;
    const curve = new Float32Array(n);
    if (amount === 0) {
        for (let i = 0; i < n; i++) curve[i] = (i * 2) / n - 1;
    } else {
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
        }
    }
    return curve;
}

function makeReverb(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 2.5);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const ch = buf.getChannelData(c);
        for (let i = 0; i < len; i++) {
            ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
        }
    }
    return buf;
}

function makeVinylNoise(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        const r = Math.random();
        ch[i] =
            r < 0.0003
                ? (Math.random() * 2 - 1) * 0.38
                : r < 0.002
                  ? (Math.random() * 2 - 1) * 0.07
                  : (Math.random() * 2 - 1) * 0.004;
    }
    return buf;
}

// ── Hook ───────────────────────────────────────────────────────────────────

interface ChainNodes {
    audioCtx: AudioContext;
    masterGain: GainNode;
    eqBass: BiquadFilterNode;
    eqMid: BiquadFilterNode;
    eqHigh: BiquadFilterNode;
    fuzzDry: GainNode;
    fuzzWet: GainNode;
    shaper: WaveShaperNode;
    reverbSend: GainNode;
    reverbWet: GainNode;
    convolver: ConvolverNode;
    echoSend: GainNode;
    delayNode: DelayNode;
    delayFB: GainNode;
    echoWet: GainNode;
    compressor: DynamicsCompressorNode;
    analyserNode: AnalyserNode;
    vinylSrc: AudioBufferSourceNode;
    vinylGain: GainNode;
}

export function useAudioChain(audioEl: HTMLAudioElement | null) {
    const nodesRef = useRef<ChainNodes | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

    const init = useCallback(() => {
        if (nodesRef.current || !audioEl) return;

        const audioCtx = new AudioContext();
        const srcNode = audioCtx.createMediaElementSource(audioEl);
        const masterGain = audioCtx.createGain();
        masterGain.gain.value = audioEl.volume;

        // EQ
        const eqBass = audioCtx.createBiquadFilter();
        eqBass.type = "lowshelf";
        eqBass.frequency.value = 200;
        const eqMid = audioCtx.createBiquadFilter();
        eqMid.type = "peaking";
        eqMid.frequency.value = 1000;
        eqMid.Q.value = 1;
        const eqHigh = audioCtx.createBiquadFilter();
        eqHigh.type = "highshelf";
        eqHigh.frequency.value = 4000;

        // Fuzz
        const shaper = audioCtx.createWaveShaper();
        shaper.oversample = "4x";
        shaper.curve = distCurve(0);
        const fuzzDry = audioCtx.createGain();
        fuzzDry.gain.value = 1;
        const fuzzWet = audioCtx.createGain();
        fuzzWet.gain.value = 0;

        // Reverb
        const convolver = audioCtx.createConvolver();
        convolver.buffer = makeReverb(audioCtx);
        const reverbSend = audioCtx.createGain();
        reverbSend.gain.value = 0;
        const reverbWet = audioCtx.createGain();
        reverbWet.gain.value = 0.55;

        // Echo
        const delayNode = audioCtx.createDelay(2.0);
        delayNode.delayTime.value = 0.36;
        const delayFB = audioCtx.createGain();
        delayFB.gain.value = 0.4;
        const echoSend = audioCtx.createGain();
        echoSend.gain.value = 0;
        const echoWet = audioCtx.createGain();
        echoWet.gain.value = 0.5;

        // Output
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        const analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.82;

        // Vinyl crackle (independent path)
        const vinylSrc = audioCtx.createBufferSource();
        vinylSrc.buffer = makeVinylNoise(audioCtx);
        vinylSrc.loop = true;
        const vinylGain = audioCtx.createGain();
        vinylGain.gain.value = 0;

        // ── Wire ──────────────────────────────────────────────────────────
        srcNode.connect(masterGain);
        masterGain.connect(eqBass);
        eqBass.connect(eqMid);
        eqMid.connect(eqHigh);

        // Fuzz split
        eqHigh.connect(fuzzDry);
        eqHigh.connect(shaper);
        shaper.connect(fuzzWet);
        fuzzDry.connect(compressor);
        fuzzWet.connect(compressor);

        // Reverb send
        eqHigh.connect(reverbSend);
        reverbSend.connect(convolver);
        convolver.connect(reverbWet);
        reverbWet.connect(compressor);

        // Echo send (with feedback loop)
        eqHigh.connect(echoSend);
        echoSend.connect(delayNode);
        delayNode.connect(delayFB);
        delayFB.connect(delayNode); // feedback
        delayNode.connect(echoWet);
        echoWet.connect(compressor);

        // Output
        compressor.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
        vinylSrc.connect(vinylGain);
        vinylGain.connect(audioCtx.destination);
        vinylSrc.start();

        nodesRef.current = {
            audioCtx,
            masterGain,
            eqBass,
            eqMid,
            eqHigh,
            fuzzDry,
            fuzzWet,
            shaper,
            reverbSend,
            reverbWet,
            convolver,
            echoSend,
            delayNode,
            delayFB,
            echoWet,
            compressor,
            analyserNode,
            vinylSrc,
            vinylGain,
        };
        setAnalyser(analyserNode);
    }, [audioEl]);

    const resume = useCallback(() => {
        nodesRef.current?.audioCtx.resume();
    }, []);

    const applyChain = useCallback((config: AudioChainConfig) => {
        const n = nodesRef.current;
        if (!n) return;
        const { eq, fx } = config;
        n.eqBass.gain.setTargetAtTime(eq.bass, n.audioCtx.currentTime, 0.02);
        n.eqMid.gain.setTargetAtTime(eq.mid, n.audioCtx.currentTime, 0.02);
        n.eqHigh.gain.setTargetAtTime(eq.treble, n.audioCtx.currentTime, 0.02);
        n.reverbSend.gain.value = fx.reverb ? 1 : 0;
        n.echoSend.gain.value = fx.echo ? 1 : 0;
        n.fuzzDry.gain.value = fx.fuzz ? 0 : 1;
        n.fuzzWet.gain.value = fx.fuzz ? 1 : 0;
        n.shaper.curve = distCurve(fx.fuzz ? 200 : 0);
        n.vinylGain.gain.value = fx.vinyl ? 0.18 : 0;
    }, []);

    const setVolume = useCallback((vol: number) => {
        if (nodesRef.current) nodesRef.current.masterGain.gain.value = vol;
    }, []);

    const isReady = (): boolean => nodesRef.current !== null;

    return { init, resume, applyChain, setVolume, isReady, analyser };
}
