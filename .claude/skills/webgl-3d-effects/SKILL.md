---
name: webgl-3d-effects
description: "Guardrails for Three.js/WebGL/canvas/shader effects in this repo: allowed ONLY at signature moments (hero sections, at most one per page), always behind a static fallback and lazy-loaded, always respecting prefers-reduced-motion, and never allowed to block LCP. Use when a hero section, product showcase, or any '3D'/'WebGL'/'shader'/'Three.js' effect is requested."
---

# WebGL / 3D Effects

WebGL/3D/shader effects are a **signature-moment tool, not a default**.
Most of this product (dashboard, forms, tables, settings) must never
reach for this skill — reach for `premium-design-taste` and
`gsap-animations` instead. This skill exists to keep the rare cases where
3D genuinely earns its cost from becoming a performance or accessibility
liability.

## When to Activate

- A hero section, landing page centerpiece, or product showcase is
  explicitly asked to feel "3D," "WebGL," "immersive," or use
  Three.js/shaders/canvas-based visual effects.
- Reviewing a diff that adds `three`, `@react-three/fiber`, a raw WebGL
  context, or a custom shader.

Do **not** activate for: ordinary scroll/hover/entrance animation (that's
`gsap-animations`), dashboard charts (2D, not this skill), or any surface
outside a genuine hero/showcase moment.

## Binding Rules (all of them, every time)

1. **One signature moment per page, maximum.** If a page already has one
   WebGL/3D effect, a second request on the same page must be pushed
   back on — ask which one actually matters, don't stack two.
2. **Hero-class surfaces only.** A page's primary hero section, a
   flagship product/feature showcase, or an explicitly-requested
   marketing centerpiece. Never a dashboard widget, a settings page, a
   table, a form, or anything a seller/buyer interacts with repeatedly in
   a work session — the novelty cost isn't worth paying twice a minute.
3. **A static fallback is not optional.** Every WebGL/3D effect ships
   with a real static image/gradient/CSS equivalent that renders
   identically in layout (same dimensions, same content position) when:
   - WebGL is unavailable (`WEBGL.isWebGLAvailable()` check, or
     equivalent capability probe, fails)
   - The component hasn't finished loading yet (see lazy-load below)
   - `prefers-reduced-motion: reduce` is set (see below — the fallback
     IS the reduced-motion experience, not a separate third state)
4. **Lazy-loaded, never in the initial bundle.** Import the Three.js/
   WebGL component with `next/dynamic` (`{ ssr: false }`) or an
   equivalent code-split boundary — it must not be part of the page's
   critical JS. The static fallback (rule 3) is what paints first while
   the 3D bundle streams in behind it.
5. **`prefers-reduced-motion: reduce` always wins.** Check it (CSS media
   query or `window.matchMedia('(prefers-reduced-motion: reduce)')`)
   before ever initializing the WebGL context. When set, render the
   static fallback permanently — never a "reduced but still animating"
   compromise.
6. **Never blocks LCP.** The Largest Contentful Paint candidate on a hero
   section must be the static fallback (an `<img>`/CSS background), not
   the canvas — the canvas paints after, as a progressive enhancement.
   If the LCP element ends up being the WebGL canvas itself, that's a
   failing implementation, not an acceptable tradeoff.
7. **Concrete performance budgets (measure, don't guess):**
   - Added JS (gzipped, the 3D library + effect code): **≤ 150KB**,
     lazy-loaded per rule 4 — this is on top of, not instead of, the
     page's normal budget.
   - Frame rate: **≥ 50fps** sustained on mid-tier mobile (throttle
     Chrome DevTools to "Mid-tier mobile" / 4x CPU slowdown and check).
   - GPU/CPU: disable/pause the render loop (via `IntersectionObserver`)
     the moment the canvas scrolls out of the viewport — never render a
     hero effect the user has already scrolled past.
   - Texture/geometry budget: prefer procedural/shader-based effects over
     large model/texture assets; if assets are used, compress
     aggressively (KTX2/Draco) and keep total scene assets **≤ 2MB**.
8. **Degrade, don't crash, on capability failure.** A WebGL context-loss
   event or an unsupported-browser detection falls back to the static
   image — it never shows a blank canvas, a console-only error, or a
   broken layout.

## Pre-ship checklist

- [ ] Confirmed this page doesn't already have a signature WebGL moment
- [ ] Confirmed this is genuinely a hero/showcase surface, not a
      dashboard/utility surface
- [ ] Static fallback exists, same layout dimensions, visually acceptable
      on its own
- [ ] Effect is lazy-loaded (`next/dynamic`, `{ ssr: false }` or
      equivalent) — not in the initial JS bundle
- [ ] `prefers-reduced-motion: reduce` is checked before context init and
      falls back to the static image, not a lighter animation
- [ ] LCP element measured (Lighthouse/DevTools) and confirmed to be the
      static fallback, not the canvas
- [ ] Added JS ≤ 150KB gzipped, confirmed via bundle analyzer
- [ ] ≥ 50fps sustained under mid-tier mobile CPU throttling
- [ ] Render loop pauses when the canvas leaves the viewport
- [ ] WebGL-unavailable / context-loss path tested and falls back cleanly
