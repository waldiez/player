import { cn } from "@/lib/utils";

import * as SliderPrimitive from "@radix-ui/react-slider";

import * as React from "react";

const Slider = React.forwardRef<
    React.ComponentRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
    <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        {...props}
    >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-player-border">
            <SliderPrimitive.Range className="absolute h-full bg-player-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-player-accent bg-player-surface shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-player-accent disabled:pointer-events-none disabled:opacity-50 hover:bg-player-accent" />
    </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
