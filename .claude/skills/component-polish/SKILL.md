---
name: component-polish
description: "Enforce complete interactive-state coverage on every UI component in this repo — buttons, inputs, selects, modals, toasts, menus, and any other clickable/focusable/loadable element must define ALL eight states (default, hover, focus-visible, active, disabled, loading, error, empty), styled with this project's monochrome design tokens (apps/web/app/globals.css). Use when building, reviewing, or shipping any interactive component."
---

# Component Polish

A component that only defines its default (resting) appearance is not
shippable in this repo, regardless of how good that default looks. This
skill is a completeness gate, not a taste filter (`premium-design-taste`
covers taste) — its job is to catch the state that got skipped.

## When to Activate

- Building or editing any interactive React component (button, input,
  select/dropdown, checkbox/radio, modal/dialog, toast/notification,
  menu/popover, tabs, accordion, table row actions, card with a click
  target).
- Reviewing a PR or diff that touches `apps/web/components/**` or any
  `apps/web/app/**` route file with interactive elements.
- Any task that says "polish," "make this feel finished," or "review this
  component."

Skip it for purely presentational, non-interactive elements (a static
badge, a read-only label) — those have no state machine to cover.

## The Eight States (all required, no exceptions)

Every interactive element must define observable, deliberate styling for
all eight. "Undefined" (silently falling back to the browser default or
to the default state's own styling) does not count as "defined."

| # | State | What it means | Common failure |
|---|---|---|---|
| 1 | **Default** | Resting appearance | (baseline — usually already done) |
| 2 | **Hover** | Pointer over, not yet pressed | Missing entirely on touch-first builds that "test fine" on desktop |
| 3 | **Focus-visible** | Reached via keyboard (Tab) | Outline suppressed (`outline: none`) with nothing substituted |
| 4 | **Active** | Currently being pressed/clicked | Identical to hover — no tactile "pressed" feedback |
| 5 | **Disabled** | Cannot be interacted with | Only `opacity` lowered — cursor still shows pointer, still focusable |
| 6 | **Loading** | Async action in flight | Button text just vanishes, or the element becomes unclickable with no visible reason why |
| 7 | **Error** | Validation or request failed | Error color used but no icon/text for colorblind users; error state has no clear path back to default |
| 8 | **Empty** | No data yet (list, search results, table) | Just a blank area — no explanation, no next action |

## Rules (checklist — verify all before calling a component done)

1. **Focus-visible is never suppressed, only restyled.** This repo already
   establishes the pattern in `globals.css`'s `.app-shell-surface
   :focus-visible` rule (`outline: 2px solid var(--color-accent);
   outline-offset: 2px`). Reuse or mirror that rule — never
   `outline: none` without a replacement that's at least as visible.
2. **Active ≠ Hover.** Active must read as "being pressed" — e.g. a scale-
   down (`scale(0.97)`), a darker step of the accent
   (`--color-accent-active` already exists for exactly this), or a
   pressed-inset shadow. If active and hover render identically, the
   active state doesn't exist yet.
3. **Disabled is unambiguous in three ways at once:** `cursor:
   not-allowed`, `pointer-events: none` (or `disabled` attribute), AND a
   visibly muted style (`--color-ink-faint` / `--color-border` rather
   than full-opacity ink/accent) — not just one of the three.
4. **Loading never leaves the user guessing.** A button mid-submit shows
   a spinner or equivalent AND is disabled for the duration — never just
   one or the other. Never let the label silently disappear.
5. **Error state has three parts, always together:** the danger token
   (`--color-danger` / `--color-danger-subtle`), a text message (never
   color-only — colorblind users and the accessibility-performance skill
   both require this), and a visible way to retry or dismiss.
6. **Empty state is never a blank rectangle.** At minimum: one line
   explaining why it's empty, and — where a next action exists (e.g. "no
   products yet") — a CTA using the accent token to take it.
7. **Only the monochrome tokens, never raw hex.** Every state above
   pulls from `apps/web/app/globals.css`'s `@theme` block
   (`--color-accent`/`-hover`/`-active`/`-subtle`, `--color-ink*`,
   `--color-border*`, `--color-danger*`, `--color-success*`,
   `--color-warning*`) — a new raw hex value in a component is a signal
   the token set is missing something, not a license to bypass it.
8. **Transitions use the existing motion tokens**, not ad-hoc durations —
   `.transition-smooth` / `.transition-smooth-fast` (from `--duration-*` /
   `--ease-standard`), so every component's state changes feel like the
   same system, not a per-component reinvention.

## Pre-ship checklist (paste into the component's PR/commit description)

- [ ] Default
- [ ] Hover
- [ ] Focus-visible (visible outline, not suppressed)
- [ ] Active (visually distinct from hover)
- [ ] Disabled (cursor + pointer-events + muted style, all three)
- [ ] Loading (if the element triggers an async action)
- [ ] Error (if the element can fail — token + text + recovery path)
- [ ] Empty (if the element renders a list/table/search result)
- [ ] All colors come from `globals.css` tokens, no raw hex
- [ ] Transitions use `.transition-smooth`/`.transition-smooth-fast`

If a row doesn't apply (e.g. a static icon button has no "empty" state),
mark it N/A explicitly rather than leaving it unchecked — an unchecked
box should always mean "not done yet," never "doesn't apply."
