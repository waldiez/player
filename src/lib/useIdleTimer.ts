/**
 * useIdleTimer — fires onIdle() after timeoutMs of no user input.
 *
 * Pass timeoutMs=null to disable (no listeners attached, no timers running).
 * Cleans up on unmount.
 */
import { useEffect, useRef } from "react";

const IDLE_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "pointermove"] as const;

export function useIdleTimer(timeoutMs: number | null, onIdle: () => void): void {
    const onIdleRef = useRef(onIdle);
    // eslint-disable-next-line react-hooks/refs
    onIdleRef.current = onIdle;

    useEffect(() => {
        if (timeoutMs === null) return;

        let timerId: ReturnType<typeof setTimeout>;

        function reset() {
            clearTimeout(timerId);
            timerId = setTimeout(() => onIdleRef.current(), timeoutMs!);
        }

        reset();

        for (const evt of IDLE_EVENTS) {
            window.addEventListener(evt, reset, { passive: true });
        }

        return () => {
            clearTimeout(timerId);
            for (const evt of IDLE_EVENTS) {
                window.removeEventListener(evt, reset);
            }
        };
    }, [timeoutMs]);
}
