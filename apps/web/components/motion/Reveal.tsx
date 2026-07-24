"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ReactNode, useEffect, useRef } from "react";
import { duration, easeString, prefersReducedMotion } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Reusable scroll-reveal wrapper (gsap-animations skill: scroll-triggered
 * reveals, staggered entrances). One implementation so every marketing/
 * dashboard section that wants "fade + rise in as it enters view" gets the
 * exact same curve/duration/distance - never a bespoke tween per page.
 * A no-op (renders children, no animation) under prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
  stagger,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  /** If set, animates direct children as a stagger instead of the container as one block. */
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const targets = stagger ? Array.from(el.children) : el;
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y,
        duration: duration.slow,
        delay,
        ease: easeString.standard,
        stagger,
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true,
        },
      });
    });

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
