/**
 * Creates an AnalyserNode from a MediaStream (e.g. microphone).
 * Does NOT connect to the audio destination — prevents speaker feedback
 * when used with microphone input.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useStreamAnalyser() {
    const ctxRef = useRef<AudioContext | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

    const connect = useCallback((stream: MediaStream) => {
        // Close any existing context
        if (ctxRef.current) {
            ctxRef.current.close();
            ctxRef.current = null;
        }
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const node = ctx.createAnalyser();
        node.fftSize = 2048;
        node.smoothingTimeConstant = 0.82;
        // Intentionally not connected to ctx.destination → no speaker feedback
        src.connect(node);
        ctxRef.current = ctx;
        setAnalyser(node);
    }, []);

    const disconnect = useCallback(() => {
        if (ctxRef.current) {
            ctxRef.current.close();
            ctxRef.current = null;
        }
        setAnalyser(null);
    }, []);

    // Auto-cleanup on unmount
    useEffect(() => {
        return () => {
            ctxRef.current?.close();
        };
    }, []);

    return { analyser, connect, disconnect };
}
