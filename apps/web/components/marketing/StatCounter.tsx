"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Counts up from 0 to `value` once it scrolls into view (gsap-animations pattern 7). Renders the final value immediately under reduced motion. */
export function StatCounter({ value, suffix = "", label }: { value: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.textContent = `${value.toLocaleString()}${suffix}`;
      return;
    }
    const counter = { val: 0 };
    const ctx = gsap.context(() => {
      gsap.to(counter, {
        val: value,
        duration: 1.6,
        ease: "power1.out",
        onUpdate: () => {
          el.textContent = `${Math.floor(counter.val).toLocaleString()}${suffix}`;
        },
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
      });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, suffix]);

  return (
    <div className="text-center">
      <p ref={ref} className="font-display text-h1 font-bold text-ink">
        0{suffix}
      </p>
      <p className="mt-2 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
