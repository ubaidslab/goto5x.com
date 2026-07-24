/**
 * GSAP-facing mirror of app/globals.css's motion tokens. CSS custom
 * properties aren't readable by GSAP tweens directly (GSAP wants plain
 * numbers/arrays), so these constants exist purely so a GSAP timeline and
 * a CSS transition never drift apart - change a duration or curve, change
 * it in both files together.
 */

/** Seconds, not ms - GSAP's native unit. */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  slower: 0.56,
} as const;

/** Same cubic-bezier curves as globals.css, as GSAP-compatible arrays. */
export const ease = {
  standard: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  emphasized: [0.34, 1.56, 0.64, 1],
} as const;

/** GSAP's CustomEase-free shorthand form of the same curves, for tweens that take a string ease. */
export const easeString = {
  standard: `cubic-bezier(${ease.standard.join(",")})`,
  in: `cubic-bezier(${ease.in.join(",")})`,
  emphasized: `cubic-bezier(${ease.emphasized.join(",")})`,
} as const;

/** A single check every GSAP entrance/scroll-trigger effect must gate on before animating. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
