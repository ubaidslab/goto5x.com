"use client";

import { gsap } from "gsap";
import { ReactNode, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Magnetic hover wrapper (gsap-animations skill) - the wrapped element
 * drifts slightly toward the cursor within its own bounds, then eases
 * back on leave. Reserved for a page's single primary CTA, never every
 * button (a magnetic effect on everything reads as noise, not premium).
 */
export function Magnetic({ children, strength = 0.35 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    gsap.to(ref.current, { x, y, duration: 0.4, ease: "power2.out" });
  }

  function onMouseLeave() {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
  }

  return (
    <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} className="inline-block">
      {children}
    </div>
  );
}
