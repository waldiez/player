import { cn } from "@/lib/utils";

interface DragHandleProps {
    direction?: "horizontal" | "vertical";
    onPointerDown: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    onPointerUp: React.PointerEventHandler<HTMLElement>;
    className?: string;
}

export function DragHandle({
    direction = "horizontal",
    onPointerDown,
    onPointerMove,
    onPointerUp,
    className,
}: DragHandleProps) {
    const isH = direction === "horizontal";
    return (
        <div
            role="separator"
            aria-orientation={isH ? "vertical" : "horizontal"}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={cn(
                "group relative z-10 flex shrink-0 select-none items-center justify-center",
                "bg-transparent transition-colors",
                "hover:bg-player-accent/15 active:bg-player-accent/25",
                isH ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
                className,
            )}
        >
            <div
                className={cn(
                    "rounded-full bg-player-border transition-colors group-hover:bg-player-accent/60",
                    isH ? "h-10 w-px" : "h-px w-10",
                )}
            />
        </div>
    );
}
