# CLAUDE.md

## UI/UX Skills Policy

Whenever doing any frontend/UI/UX work in this repo, actively use the
installed skills below for the concern they cover. Prefer the skill's
guidance over ad-hoc judgment for anything it addresses.

| Concern | Skill | Status |
|---|---|---|
| Typography, color, spacing, layout (design taste) | `premium-design-taste` | Available (pre-installed, not from the repo below) |
| Scroll reveals, staggered entrances, hover effects, parallax | `gsap-animations` | Available (pre-installed, not from the repo below) |
| General UI/UX intelligence — styles, palettes, typography, charts, per-stack (React/Next/Vue/Svelte/shadcn/etc.) guidelines | `ui-ux-pro-max` | Installed (`.claude/skills/ui-ux-pro-max`, from `github.com/nextlevelbuilder/ui-ux-pro-max-skill`) |
| shadcn/ui + Tailwind styling helpers (fonts, component add/theming scripts) | `ui-styling` | Installed (`.claude/skills/ui-styling`, same repo) |
| Design-system tokens, slide/background generation | `design-system` | Installed (`.claude/skills/design-system`, same repo) |
| Brand color extraction / brand asset helpers | `brand` | Installed (`.claude/skills/brand`, same repo) |
| Banner design | `banner-design` | Installed (`.claude/skills/banner-design`, same repo) |
| Slide decks | `slides` | Installed (`.claude/skills/slides`, same repo) |
| General design review workflow | `design` | Installed (`.claude/skills/design`, same repo) |
| Every interactive state (hover/focus/active/disabled/loading/error/empty) | `component-polish` | Authored for this repo (`.claude/skills/component-polish`) — not from the repo above, which doesn't contain it |
| Signature WebGL/3D moments (heroes only, performance-safe) | `webgl-3d-effects` | Authored for this repo (`.claude/skills/webgl-3d-effects`) — not from the repo above, which doesn't contain it |
| Keyboard nav, contrast, Core Web Vitals | `accessibility-performance` | Authored for this repo (`.claude/skills/accessibility-performance`) — not from the repo above, which doesn't contain it |

**Provenance note:** the `nextlevelbuilder/ui-ux-pro-max-skill` GitHub
repo (verified directly) only contains the seven skills listed first
above — it does not contain `component-polish`, `webgl-3d-effects`, or
`accessibility-performance`. Those three were authored directly for this
project (concrete, checklist-style rules grounded in this repo's actual
token file and file layout) rather than fabricated as if they came from
that repo. If `nextlevelbuilder/ui-ux-pro-max-skill` ever ships real
versions of these three, prefer swapping in the upstream ones and
diffing against these project-authored versions before replacing them.

## Design Direction (binding for all UI work)

- **UZEYN is the final brand — no longer dummy/placeholder, no longer
  monochrome (v1.4, founder decision D140, 2026-10-19).** This supersedes
  the entire v1.3 monochrome pass below (which itself superseded the
  earlier cream/green + Alegreya SC pass before it) — that is now TWO
  reversals on record for this file, so treat any color/brand direction
  here as live until the next dated entry says otherwise, not as
  permanent on the strength of how firmly a past entry was worded.
  Palette: **bottle green `#0B2B24`** (ink/primary — the role
  `--color-ink`/`--color-accent` used to split between near-black and
  "no hue" now both resolve to this), **paper `#EEF0E6`** (the near-white
  surface/canvas role — a warm ledger-paper tint, not pure white), and
  **brass `#D9AE45`** (the one accent — used deliberately and sparingly:
  primary CTA fill, active-nav, focus rings, the brand mark's
  misregistration outline — not spread across every icon/border the way
  a default Tailwind accent would be). Semantic/status colors stay
  exactly as untouched as they were under the old rule — see "Status
  colors stay functional, not brand" below, unaffected by either color
  pass.
- **Tokens are the single source of truth** — same mechanism as before
  (`apps/web/app/globals.css`'s `@theme` block, mirrored in
  `apps/api/src/design-tokens/design-tokens.constants.ts` for the admin
  lockable color-token panel), now carrying bottle-green/paper/brass
  values instead of the grayscale ones. **This repo-wide re-skin is
  Phase 3 (UI/UX design-system pass) work, not yet executed** — this
  entry records the locked target direction tokens must move to, not a
  claim that every page has already been repainted. Until that phase
  lands, don't assume a given screen already reflects this; check the
  actual token values in `globals.css` for what's live today.
- **Typography: one family, Schibsted Grotesk, self-hosted (OFL) —
  everywhere, dense UI and marketing headlines alike.** This replaces
  the old Inter-for-dense-UI / serif-for-marketing-headlines split
  entirely, not just the font name within the same split — the whole
  point of the old split (no serif in dense UI) is now moot since
  nothing in the new system is a serif face at all. The one deliberate
  exception, carried over structurally from the old rule: the brand
  **mark** itself (not body text, not a heading) — the blackletter
  "uyz" monogram (UnifrakturCook Bold, OFL, outlines unioned, brass
  misregistration outline) used as the literal logo/wordmark graphic in
  `Sidebar.tsx`/`AdminSidebar.tsx`/the store-creation page and anywhere
  else the mark itself appears — stays blackletter because it's a
  graphic mark, not a font choice for reading text.
- **Seller-facing dashboard color personalization is untouched.** Module
  10/FR-28.4's opt-in emerald/amber/rose accent presets (a seller's own
  workspace choice, not the platform's brand identity) still work exactly
  as before — only the platform DEFAULT (before a seller picks one) is
  now bottle green/brass instead of monochrome, per the same "keep this
  shipped, tested feature" reasoning the old rule already recorded.
- **Status colors stay functional, not brand.** Order/verification/
  moderation status colors (`--color-success`/`-warning`/`-danger`/
  `-info`) were never part of any brand-color pass, this one included —
  same "status pills stay distinct, never folded into brand palette"
  rule locked since Phase 1.
- **Buyer-facing storefronts (D-Studio) stay a separate, seller-chosen
  system**, same Phase 1 three-system separation as before — a seller's
  own storefront theme (`lib/theme-presets.ts`, `app/storefront/`) is
  not forced onto the platform's own brand palette. Separately (D149,
  not a brand-color question): storefront *templates* themselves are
  being redesigned premium/mobile-first/image-led — that's a template-
  quality pass, not this file's brand-color scope, and doesn't override
  a seller's own theme choice once applied.
- **Branding is final — the opposite of the old rule, not a continuation
  of it.** The platform will NOT be renamed before launch; UZEYN is it.
  `Sidebar.tsx`'s placeholder `Wordmark()` component and the old
  "nothing in new UI copy may hard-code the current platform name" rule
  are both retired — new UI copy may say "UZEYN" directly. The brand-
  asset/content-page system (SRS FR-12.1/FR-12.3, Module 17) stays in
  place as genuinely useful admin-editable-content infrastructure, just
  no longer load-bearing for "a future rebrand must be a data change" —
  there is no future rebrand being planned for anymore.
- **Plan tier names always carry their subtitle.** GO/RUN/RISE/FLY are
  creative names, not self-explanatory ones — every surface that shows
  one of these four individual-tier names (nav, billing/plan pages,
  plan-gate upsell messaging in any future phase) must pair it with its
  short "who this is for" subtitle via `apps/web/lib/plan-tier-copy.ts`'s
  `planTierSubtitle()` (GO — for new sellers · RUN — for growing stores ·
  RISE — for established sellers · FLY — for high-volume operations).
  Team/Supplier plan names are unaffected — already self-explanatory, no
  subtitle defined for them.
