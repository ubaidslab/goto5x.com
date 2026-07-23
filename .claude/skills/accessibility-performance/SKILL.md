---
name: accessibility-performance
description: "Keyboard navigability, visible focus states, WCAG AA contrast on this project's monochrome palette, semantic landmarks, alt text, and Core Web Vitals budgets (LCP/CLS/INP) — checked on every shipped page, not sampled. Use when building, reviewing, or shipping any page or component in apps/web."
---

# Accessibility & Performance

Every page shipped in `apps/web` gets checked against this skill before
it's considered done — this is a gate on every page, not a periodic audit
on a sample of pages. Accessibility and performance are grouped in one
skill deliberately: both are non-negotiable, both are cheap to verify
early and expensive to retrofit later, and both get skipped for the same
reason (nobody re-checked before shipping) if left to a separate pass.

## When to Activate

- Any new page, route, or significant component in `apps/web`.
- Any change to focus handling, color tokens, semantic HTML structure, or
  image/media rendering.
- Before marking any UI task "done."

## Part 1 — Keyboard Navigation (every flow, no exceptions)

1. **Every interactive element is reachable by Tab, in a logical order**
   matching visual/reading order — never relying on a positive
   `tabindex` to reorder (fix the DOM order instead).
2. **Every flow is completable with a keyboard alone** — signup, login,
   checkout, product edit, settings save. If a mouse-only interaction
   exists anywhere in a required flow (a drag-only reorder, a
   hover-reveal-only action with no keyboard equivalent), that's a
   failing flow, not an edge case.
3. **Escape closes** any modal/dialog/popover/menu and returns focus to
   the element that opened it — focus must never get "lost" (dropped to
   `<body>`) after a close.
4. **Focus is trapped inside an open modal/dialog** (Tab cycles within
   it, doesn't leak to the page behind it) and **restored** to the
   trigger element on close.
5. **No keyboard traps** — a user must always be able to Tab (or
   Shift+Tab) out of any component.

## Part 2 — Visible Focus States

1. **Focus-visible is never suppressed** (`outline: none` with nothing
   substituted is an automatic failure). This repo's own pattern
   (`globals.css`'s `.app-shell-surface :focus-visible` — `outline: 2px
   solid var(--color-accent); outline-offset: 2px`) is the baseline every
   new interactive surface should extend to, not reinvent.
2. **The focus ring must be visible against every surface it can appear
   on** — check it against `--color-canvas`, `--color-surface`, and
   `--color-surface-raised` (light mode) and their dark-mode
   counterparts, not just whichever one was open during development.

## Part 3 — WCAG AA Contrast (on THIS palette specifically)

This project's tokens are monochrome-plus-one-accent
(`apps/web/app/globals.css`) — that constraint makes contrast checking
*easier* (fewer color combinations to verify) but not optional.

1. **Body text (`--color-ink` on `--color-canvas`/`--color-surface`):
   ≥ 4.5:1.** Already comfortably passes with the current values
   (`#1d1d1f` on `#f5f5f7`/`#ffffff`) — if either token value changes,
   re-verify.
2. **Muted text (`--color-ink-muted`, `--color-ink-faint`) used for body
   copy must still hit 4.5:1** — these tokens are safe for secondary
   labels/captions at their current values, but **not safe for
   body-length text at small sizes**; don't reach for `-faint` on
   anything a user must read carefully.
3. **Large text / UI components (18px+/bold 14px+, buttons, form
   borders): ≥ 3:1.**
4. **The accent (`--color-accent`) against its background must hit 3:1
   minimum** wherever it's the only signal of state (e.g. a link with no
   underline) — pair with an underline or icon for body-text links rather
   than relying on the accent color alone regardless.
5. **Never color-only.** Success/warning/danger states
   (`--color-success`/`--color-warning`/`--color-danger`) must always
   pair with text or an icon — a colorblind user must be able to tell
   states apart without perceiving hue at all.
6. **Re-verify both light and dark token blocks** — a contrast pass in
   light mode says nothing about the `@media (prefers-color-scheme:
   dark)` override block, which uses different values entirely.

## Part 4 — Semantic Structure & Alt Text

1. **One `<h1>` per page**, heading levels never skip (no `<h2>` straight
   to `<h4>`).
2. **Landmarks present**: `<header>`/`<nav>`/`<main>`/`<footer>` (or
   equivalent ARIA roles) so a screen-reader user can jump between
   regions instead of reading linearly through everything.
3. **Every `<img>` has `alt`** — descriptive for meaningful images
   (product photos, illustrations), `alt=""` (empty, not omitted) for
   purely decorative ones. Never a filename or "image" as the alt text.
4. **Icon-only buttons have an accessible name** (`aria-label` or
   visually-hidden text) — an icon alone is not a name.
5. **Form inputs have a programmatically-associated `<label>`**
   (`htmlFor`/`id` pair, or wrapping) — a placeholder is never a
   substitute for a label.

## Part 5 — Core Web Vitals Budgets (checked on every shipped page)

| Metric | Target | What breaks it here |
|---|---|---|
| **LCP** (Largest Contentful Paint) | **≤ 2.5s** | Unoptimized hero images, render-blocking fonts/CSS, a WebGL canvas as the LCP element (see `webgl-3d-effects` — the static fallback should be the LCP candidate, not the canvas) |
| **CLS** (Cumulative Layout Shift) | **≤ 0.1** | Images/embeds without explicit width/height (or `aspect-ratio`), late-loading banners/ads pushing content, web fonts causing reflow (use `font-display: swap` with a matched fallback, already the case for Inter in this repo) |
| **INP** (Interaction to Next Paint) | **≤ 200ms** | Long synchronous tasks on click/input handlers, unthrottled input handlers on search/filter fields, heavy re-renders on every keystroke |

Check with Lighthouse (or Chrome DevTools Performance panel) on the
actual built page, not just `next dev` — dev-mode timings are not
representative.

## Pre-ship checklist

- [ ] Full flow completable keyboard-only (no mouse)
- [ ] Escape closes overlays and restores focus to the trigger
- [ ] Focus never suppressed; visible against every surface it can land on
- [ ] Body text ≥ 4.5:1, large text/UI ≥ 3:1 (both light and dark tokens)
- [ ] No state communicated by color alone
- [ ] One `<h1>`, no skipped heading levels, landmarks present
- [ ] Every image has correct `alt` (descriptive or `alt=""`)
- [ ] Icon-only controls have an accessible name
- [ ] Every form input has an associated `<label>`
- [ ] LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms measured on the built page
