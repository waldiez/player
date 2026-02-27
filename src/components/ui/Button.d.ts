import { type VariantProps } from "class-variance-authority";

import * as React from "react";

declare const buttonVariants: (
    props?:
        | ({
              variant?:
                  | "default"
                  | "destructive"
                  | "outline"
                  | "secondary"
                  | "ghost"
                  | "link"
                  | null
                  | undefined;
              size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | null | undefined;
          } & import("class-variance-authority/types").ClassProp)
        | undefined,
) => string;
export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}
declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export { Button, buttonVariants };
