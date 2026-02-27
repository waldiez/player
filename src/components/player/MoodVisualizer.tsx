/**
 * MoodVisualizer — Canvas-based audio visualizer for the 4 mood modes.
 * Drop it wherever a video player would go; it needs no media source of its own.
 */
import { useEffect, useRef } from "react";

import {
    drawDisco,
    drawDock,
    drawFest,
    drawIdle,
    drawJourney,
    drawPop,
    drawRock,
    drawStorm,
} from "../../lib/moodDrawers";
import { MOOD_META } from "../../types/mood";
import type { MoodMode } from "../../types/mood";

interface MoodVisualizerProps {
    mode: MoodMode;
    analyser: AnalyserNode | null;
    isPlaying: boolean;
    className?: string;
    /** Override the accent colour (for user-customized moods). */
    accentOverride?: string;
    /** Override the background colour (for user-customized moods). */
    bgOverride?: string;
}

export function MoodVisualizer({
    mode,
    analyser,
    isPlaying,
    className = "",
    accentOverride,
    bgOverride,
}: MoodVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number>(0);
    const angleRef = useRef<number>(0); // vinyl (dock) rotation
    const discoAngleRef = useRef<number>(0); // disco ball rotation
    const lastTsRef = useRef<number>(0);
    const freqDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(1024) as Uint8Array<ArrayBuffer>);

    // Keep a ref to the current props so the rAF closure always reads fresh values
    const propsRef = useRef({ mode, analyser, isPlaying, accentOverride, bgOverride });
    useEffect(() => {
        propsRef.current = { mode, analyser, isPlaying, accentOverride, bgOverride };
    }, [mode, analyser, isPlaying, accentOverride, bgOverride]);

    // Update analyser buffer size whenever the node changes
    useEffect(() => {
        if (analyser) {
            freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
    }, [analyser]);

    // Canvas resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.parentElement) return;

        function resize() {
            if (!canvas || !canvas.parentElement) return;
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        const ro = new ResizeObserver(resize);
        ro.observe(canvas.parentElement);
        resize();
        return () => ro.disconnect();
    }, []);

    // Animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        function frame(ts: number) {
            frameRef.current = requestAnimationFrame(frame);
            const ctx = canvas!.getContext("2d");
            if (!ctx) return;

            const dt = Math.min((ts - (lastTsRef.current || ts)) / 1000, 0.1);
            lastTsRef.current = ts;

            const {
                mode: m,
                analyser: an,
                isPlaying: playing,
                accentOverride: accent,
                bgOverride: _bg,
            } = propsRef.current;

            if (an) an.getByteFrequencyData(freqDataRef.current);

            const W = canvas!.offsetWidth;
            const H = canvas!.offsetHeight;
            if (!W || !H) return;

            // Bass energy for vinyl spin
            const freqData = freqDataRef.current;
            let bassSum = 0;
            const bassCount = Math.max(1, Math.floor(freqData.length * 0.07));
            for (let i = 0; i < bassCount; i++) bassSum += freqData[i];
            const beat = bassSum / bassCount / 255;

            if (playing) {
                angleRef.current += dt * Math.PI * 2 * (0.4 + beat * 0.35);
                discoAngleRef.current += dt * Math.PI * 2 * 0.12; // steady disco spin
            }

            if (!an || !playing) {
                drawIdle(ctx, W, H, ts, accent ?? MOOD_META[m].accent);
                return;
            }

            switch (m) {
                case "journey":
                    drawJourney(ctx, W, H, ts, freqData);
                    break;
                case "dock":
                    drawDock(ctx, W, H, ts, freqData, angleRef.current);
                    break;
                case "storm":
                    drawStorm(ctx, W, H, ts, freqData, playing);
                    break;
                case "fest":
                    drawFest(ctx, W, H, ts, freqData, playing);
                    break;
                case "rock":
                    drawRock(ctx, W, H, ts, freqData, playing);
                    break;
                case "pop":
                    drawPop(ctx, W, H, ts, freqData, playing);
                    break;
                case "disco":
                    drawDisco(ctx, W, H, ts, freqData, playing, discoAngleRef.current);
                    break;
            }
        }

        frameRef.current = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(frameRef.current);
    }, []); // stable — reads fresh values via propsRef

    const meta = MOOD_META[mode];

    return (
        <div
            className={`relative w-full h-full overflow-hidden ${className}`}
            style={{ background: bgOverride ?? meta.bg }}
        >
            <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "100%" }}
                aria-label={`${meta.label} visualizer`}
            />
        </div>
    );
}
