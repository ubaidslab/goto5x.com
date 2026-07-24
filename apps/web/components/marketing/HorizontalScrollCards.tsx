"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ReactNode, useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * dayos-style pinned horizontal-scroll card section: the section pins in
 * place while vertical scroll drives the card track sideways. Desktop
 * (>=1024px) only - `ScrollTrigger.matchMedia` disables the pin/scrub
 * below that per gsap-animations' mobile guidance (pinned horizontal
 * scroll is routinely janky on touch, and a native horizontally-scrollable
 * row is the more usable mobile pattern anyway). `prefers-reduced-motion`
 * always wins: renders as a plain scrollable row, no pin, no scrub.
 */
export function HorizontalScrollCards({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const distance = () => track.scrollWidth - section.offsetWidth;
        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
          },
        });
        return () => tween.scrollTrigger?.kill();
      });
      return () => mm.revert();
    }, section);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={sectionRef} className="overflow-hidden lg:h-screen">
      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-auto px-6 pb-4 [scrollbar-width:none] snap-x snap-mandatory lg:h-full lg:snap-none lg:items-center lg:overflow-visible lg:pb-0 lg:[will-change:transform]"
      >
        {children}
      </div>
    </div>
  );
}
