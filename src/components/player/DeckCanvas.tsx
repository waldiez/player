/**
 * DeckCanvas — compact frequency-bar visualizer for a single DJ deck.
 * Draws an idle sine wave when no analyser is connected, frequency bars when playing.
 */
import { useEffect, useRef } from "react";

interface DeckCanvasProps {
    analyser: AnalyserNode | null;
    isPlaying: boolean;
    accent?: string;
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

export function DeckCanvas({ analyser, isPlaying, accent = "#06b6d4" }: DeckCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef(0);
    const freqDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(1024) as Uint8Array<ArrayBuffer>);
    const propsRef = useRef({ analyser, isPlaying, accent });

    useEffect(() => {
        propsRef.current = { analyser, isPlaying, accent };
    }, [analyser, isPlaying, accent]);

    useEffect(() => {
        if (analyser) {
            freqDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
        }
    }, [analyser]);

    // Canvas resize — mirrors MoodVisualizer pattern
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

    // rAF draw loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let idlePhase = 0;

        function draw(_: number) {
            if (!canvas) return;
            frameRef.current = requestAnimationFrame(draw);

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const W = canvas.clientWidth;
            const H = canvas.clientHeight;
            const { analyser: an, isPlaying: playing, accent: ac } = propsRef.current;

            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, W, H);

            if (an && playing) {
                an.getByteFrequencyData(freqDataRef.current);
                // Use first half of bins (upper half is mostly silence)
                const bins = Math.min(Math.floor(freqDataRef.current.length / 2), 128);
                const barW = W / bins;

                for (let i = 0; i < bins; i++) {
                    const v = freqDataRef.current[i] / 255;
                    const barH = v * H * 0.92;
                    ctx.fillStyle = hexToRgba(ac, 0.35 + v * 0.65);
                    ctx.fillRect(i * barW + 0.5, H - barH, barW - 1, barH);
                }
                // Subtle center line
                ctx.fillStyle = "rgba(255,255,255,0.06)";
                ctx.fillRect(0, H / 2, W, 1);
            } else if (an && !playing) {
                // Paused — frozen dim bars
                an.getByteFrequencyData(freqDataRef.current);
                const bins = Math.min(Math.floor(freqDataRef.current.length / 2), 128);
                const barW = W / bins;
                for (let i = 0; i < bins; i++) {
                    const v = freqDataRef.current[i] / 255;
                    const barH = v * H * 0.92;
                    ctx.fillStyle = hexToRgba(ac, 0.12);
                    ctx.fillRect(i * barW + 0.5, H - barH, barW - 1, barH);
                }
            } else {
                // No source — idle sine wave
                idlePhase += 0.018;
                ctx.beginPath();
                ctx.strokeStyle = hexToRgba(ac, 0.18);
                ctx.lineWidth = 1.5;
                const amp = H * 0.14;
                const cy = H / 2;
                for (let x = 0; x <= W; x++) {
                    const y =
                        cy + Math.sin(x * 0.04 + idlePhase) * amp * Math.sin(x * 0.007 + idlePhase * 0.4);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }

        frameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frameRef.current);
    }, []);

    return <canvas ref={canvasRef} className="h-full w-full" />;
}
