"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium select-none " +
  "transition-smooth-fast active:scale-[0.98] " +
  "disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/* Every variant below defines its own hover/active pair, not just a hover -
   active states in this system are always one notch further than hover
   (darker/deeper), never identical to it (see component-polish's 8-state
   rule). */
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent shadow-xs hover:bg-accent-hover active:bg-accent-active",
  secondary: "border border-border bg-surface text-ink shadow-xs hover:border-border-strong hover:bg-canvas active:bg-border/40",
  outline: "border border-border-strong bg-transparent text-ink hover:bg-canvas active:bg-border/40",
  ghost: "text-ink-muted hover:bg-canvas hover:text-ink active:bg-border/40",
  danger: "bg-danger text-on-accent shadow-xs hover:brightness-110 active:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** The one button component every screen in this product uses - same placement/behavior everywhere (SIMPLICITY INVARIANT, §3.13(d)). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
