/**
 * useSwipeGesture — returns touch event handlers that detect swipe direction.
 */
import { useCallback, useRef } from "react";

interface SwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    minDistance?: number;
}

interface SwipeHandlers {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 50,
}: SwipeOptions): SwipeHandlers {
    const startX = useRef(0);
    const startY = useRef(0);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        startX.current = touch.clientX;
        startY.current = touch.clientY;
    }, []);

    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            const touch = e.changedTouches[0];
            if (!touch) return;
            const dx = touch.clientX - startX.current;
            const dy = touch.clientY - startY.current;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (Math.max(absDx, absDy) < minDistance) return;

            if (absDx > absDy) {
                // Horizontal swipe
                if (dx < 0) onSwipeLeft?.();
                else onSwipeRight?.();
            } else {
                // Vertical swipe
                if (dy < 0) onSwipeUp?.();
                else onSwipeDown?.();
            }
        },
        [minDistance, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown],
    );

    return { onTouchStart, onTouchEnd };
}
