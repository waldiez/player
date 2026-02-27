/**
 * Manages a single getUserMedia MediaStream lifecycle.
 * Automatically stops tracks on unmount.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useMediaStream() {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const acquire = useCallback(async (constraints: MediaStreamConstraints) => {
        // Stop any existing tracks first
        if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) track.stop();
            streamRef.current = null;
        }
        setError(null);
        try {
            const s = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = s;
            setStream(s);
            return s;
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Permission denied";
            setError(msg);
            setStream(null);
            return null;
        }
    }, []);

    const release = useCallback(() => {
        if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) track.stop();
            streamRef.current = null;
        }
        setStream(null);
        setError(null);
    }, []);

    // Auto-cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                for (const track of streamRef.current.getTracks()) track.stop();
            }
        };
    }, []);

    return { stream, error, acquire, release };
}
