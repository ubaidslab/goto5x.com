"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { duration, easeString, prefersReducedMotion } from "@/lib/motion";

const tones = {
  neutral: "bg-canvas text-ink-muted",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
} as const;

const dotTones = {
  neutral: "bg-ink-faint",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
} as const;

/**
 * Status pill - semantic tone carries meaning independent of the accent
 * color, per this system's "color + form, never color alone" rule. `dot`
 * adds a status indicator for scan-at-a-glance tables.
 *
 * Founder batch A5 - a status-changing action (Mark as paid, a bulk
 * publish/archive, mark delivered...) had no visual confirmation beyond
 * this pill silently swapping color/text; several of those actions show
 * no toast either, so the badge itself was the only feedback a seller got
 * that anything happened. Pops on every `tone` change after mount (never
 * on first render - the page's own Reveal already handles initial
 * entrance, animating here too would double up) with a small emphasized-
 * ease scale, matching this project's micro-interaction timing
 * (lib/motion.ts's duration.base/ease.emphasized). Skips animating (but
 * still updates) under prefers-reduced-motion.
 */
export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: keyof typeof tones;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const prevTone = useRef(tone);

  useEffect(() => {
    if (prevTone.current === tone) return;
    prevTone.current = tone;
    if (!ref.current || prefersReducedMotion()) return;
    gsap.fromTo(
      ref.current,
      { scale: 0.85, opacity: 0.6 },
      { scale: 1, opacity: 1, duration: duration.base, ease: easeString.emphasized },
    );
  }, [tone]);

  return (
    <span
      ref={ref}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotTones[tone])} aria-hidden />}
      {children}
    </span>
  );
}
