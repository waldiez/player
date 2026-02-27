import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

import { Slot } from "@radix-ui/react-slot";

import * as React from "react";

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-player-accent disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-player-accent text-white hover:bg-player-accent-hover",
                destructive: "bg-player-error text-white hover:bg-player-error/90",
                outline:
                    "border border-player-border bg-transparent hover:bg-player-surface hover:text-player-text",
                secondary: "bg-player-surface text-player-text hover:bg-player-border",
                ghost: "hover:bg-player-surface hover:text-player-text",
                link: "text-player-accent underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-10 rounded-md px-8",
                icon: "h-9 w-9",
                "icon-sm": "h-7 w-7",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
    },
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
