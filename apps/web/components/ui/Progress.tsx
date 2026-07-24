"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { ComponentPropsWithoutRef, ElementRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Progress = forwardRef<ElementRef<typeof ProgressPrimitive.Root>, ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>>(
  ({ className, value, ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-border", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full flex-1 rounded-full bg-accent transition-[transform]"
        style={{
          transform: `translateX(-${100 - (value ?? 0)}%)`,
          transitionDuration: "var(--duration-slow)",
          transitionTimingFunction: "var(--ease-standard)",
        }}
      />
    </ProgressPrimitive.Root>
  ),
);
Progress.displayName = ProgressPrimitive.Root.displayName;
