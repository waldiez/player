import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import * as React from "react";

declare const TooltipProvider: React.FC<TooltipPrimitive.TooltipProviderProps>;
declare const TooltipRoot: React.FC<TooltipPrimitive.TooltipProps>;
declare const TooltipTrigger: React.ForwardRefExoticComponent<
    TooltipPrimitive.TooltipTriggerProps & React.RefAttributes<HTMLButtonElement>
>;
declare const TooltipContent: React.ForwardRefExoticComponent<
    Omit<TooltipPrimitive.TooltipContentProps & React.RefAttributes<HTMLDivElement>, "ref"> &
        React.RefAttributes<HTMLDivElement>
>;
interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    delayDuration?: number;
}
declare function Tooltip({
    content,
    children,
    side,
    delayDuration,
}: TooltipProps): import("react/jsx-runtime").JSX.Element;
export { Tooltip, TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider };
