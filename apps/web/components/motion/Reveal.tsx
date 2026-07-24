"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ReactNode, useRef } from "react";
import { duration, easeString, prefersReducedMotion } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  // ScrollTrigger caches each trigger's pixel start/end at creation time.
  // next/font's `display: "swap"` paints a fallback face first, then swaps
  // to the real font once it loads - which reflows line-height/character
  // widths and can invalidate an already-cached trigger position. One
  // global refresh once fonts settle keeps every Reveal on every page
  // correctly positioned, not just whichever one happened to expose it.
  document.fonts?.ready?.then(() => ScrollTrigger.refresh());
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

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;

      const targets = stagger ? Array.from(el.children) : el;

      // A target here may carry .transition-smooth(-fast) for its OWN
      // hover/press states (e.g. PricingCard's CTA button) - that utility's
      // transition-property defaults to "all", which includes opacity and
      // transform. Left alone, the CSS transition engine and this tween's
      // rAF-driven updates both fight to own the same two properties, and
      // the reveal can get stuck rendered at its "from" state permanently
      // (found on the Phase 2 pricing page's PricingCards). Suspend any
      // CSS transition on these targets for exactly the reveal's duration,
      // then hand the property back so the element's own hover/press
      // transitions resume normally afterward.
      gsap.set(targets, { transition: "none" });
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
        onComplete: () => gsap.set(targets, { clearProps: "transition" }),
      });
    },
    { scope: ref, dependencies: [stagger, delay, y] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
