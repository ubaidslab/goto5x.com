"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { ComponentPropsWithoutRef, ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = forwardRef<ElementRef<typeof ToastPrimitive.Viewport>, ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm",
        className,
      )}
      {...props}
    />
  ),
);
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toneClasses = {
  default: "border-border bg-surface text-ink",
  success: "border-success/25 bg-success-subtle text-ink",
  danger: "border-danger/25 bg-danger-subtle text-ink",
} as const;

export const Toast = forwardRef<
  ElementRef<typeof ToastPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { tone?: keyof typeof toneClasses }
>(({ className, tone = "default", ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      "uzeyn-overlay group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg",
      "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0",
      "data-[swipe=end]:animate-[overlay-out_var(--duration-fast)_var(--ease-in)]",
      toneClasses[tone],
      className,
    )}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

export const ToastTitle = forwardRef<ElementRef<typeof ToastPrimitive.Title>, ComponentPropsWithoutRef<typeof ToastPrimitive.Title>>(
  ({ className, ...props }, ref) => <ToastPrimitive.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />,
);
ToastTitle.displayName = ToastPrimitive.Title.displayName;

export const ToastDescription = forwardRef<ElementRef<typeof ToastPrimitive.Description>, ComponentPropsWithoutRef<typeof ToastPrimitive.Description>>(
  ({ className, ...props }, ref) => <ToastPrimitive.Description ref={ref} className={cn("mt-0.5 text-sm text-ink-muted", className)} {...props} />,
);
ToastDescription.displayName = ToastPrimitive.Description.displayName;

export const ToastClose = forwardRef<ElementRef<typeof ToastPrimitive.Close>, ComponentPropsWithoutRef<typeof ToastPrimitive.Close>>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Close
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-sm p-1 text-ink-faint opacity-0 transition-smooth-fast",
        "hover:text-ink group-hover:opacity-100",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
      toast-close=""
      {...props}
    >
      <X className="h-3.5 w-3.5" />
    </ToastPrimitive.Close>
  ),
);
ToastClose.displayName = ToastPrimitive.Close.displayName;

export const ToastAction = forwardRef<ElementRef<typeof ToastPrimitive.Action>, ComponentPropsWithoutRef<typeof ToastPrimitive.Action>>(
  ({ className, ...props }, ref) => (
    <ToastPrimitive.Action
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink",
        "transition-smooth-fast hover:bg-canvas",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      {...props}
    />
  ),
);
ToastAction.displayName = ToastPrimitive.Action.displayName;
