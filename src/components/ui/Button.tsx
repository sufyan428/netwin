"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd"> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-transparent hover:brightness-110 shadow-sm",
  secondary:
    "bg-surface-2 text-text border-border hover:bg-surface-hover",
  ghost:
    "bg-transparent text-text-muted border-transparent hover:bg-surface-hover hover:text-text",
  danger:
    "bg-transparent text-danger border-border hover:border-danger/40 hover:bg-danger/10",
};

const sizeClass: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1",
  md: "text-sm px-3.5 py-2 gap-1.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "sm", children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.96 }}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border font-medium transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          variantClass[variant],
          sizeClass[size],
          className
        )}
        {...(props as HTMLMotionProps<"button">)}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "sm", children, ...props }, ref) => {
    const dim = size === "sm" ? "w-8 h-8" : "w-9 h-9";
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.92 }}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border transition-colors shrink-0",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          dim,
          variantClass[variant],
          className
        )}
        {...(props as HTMLMotionProps<"button">)}
      >
        {children}
      </motion.button>
    );
  }
);
IconButton.displayName = "IconButton";
