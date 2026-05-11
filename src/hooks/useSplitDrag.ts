import { useCallback, useRef, useState } from "react";

interface UseSplitDragOpts {
    /** Starting pixel size of the controlled panel */
    initial: number;
    min?: number;
    max?: number;
    direction?: "horizontal" | "vertical";
    /** When true the handle sits on the LEFT/TOP edge of the panel (right/bottom panels).
     *  Dragging toward the panel shrinks the OTHER side, so delta is inverted. */
    reverse?: boolean;
}

export function useSplitDrag({
    initial,
    min = 80,
    max = 1200,
    direction = "horizontal",
    reverse = false,
}: UseSplitDragOpts) {
    const [px, setPx] = useState(initial);
    const drag = useRef<{ startPos: number; startPx: number } | null>(null);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLElement>) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = {
                startPos: direction === "horizontal" ? e.clientX : e.clientY,
                startPx: px,
            };
        },
        [direction, px],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLElement>) => {
            if (!drag.current) return;
            const delta = (direction === "horizontal" ? e.clientX : e.clientY) - drag.current.startPos;
            const next = drag.current.startPx + (reverse ? -delta : delta);
            setPx(Math.max(min, Math.min(max, next)));
        },
        [direction, min, max, reverse],
    );

    const onPointerUp = useCallback(() => {
        drag.current = null;
    }, []);

    return { px, onPointerDown, onPointerMove, onPointerUp };
}
