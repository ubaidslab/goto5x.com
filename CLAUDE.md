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

- **Fully monochrome — FINAL, no accent hue anywhere (v1.3).** This
  supersedes every earlier color decision recorded in this file and in
  the Founder batch A2/A3 history (a cream/green brand palette + Alegreya
  SC on every heading) — that pass shipped and was later fully reversed
  by this one, not merely re-pointed at a different hue. Near-white
  surfaces, true near-black ink, a grayscale scale between, and **zero**
  accent color: the interactive role an accent hue used to play (primary
  CTA fill, active nav, focus rings, links) is now filled by solid
  near-black in light mode / near-white in dark mode — apple.com
  discipline taken one step further, horizonx.so motion unchanged.
  Semantic/status colors (order/verification/moderation state) are
  explicitly untouched — see "Status colors stay functional, not brand"
  below.
- **Tokens are the single source of truth**
  (`apps/web/app/globals.css`'s `@theme` block, mirrored in
  `apps/api/src/design-tokens/design-tokens.constants.ts` for the admin
  lockable color-token panel — Module 92/A6, no rebuild needed, just new
  default values entered through it). Every neutral
  (`--color-canvas`/`--color-surface`/`--color-border`/`--color-ink`…)
  is a true R=G=B grayscale value, no warm/cream or green tint anywhere.
  `--color-accent` deliberately equals `--color-ink`'s value now (there's
  no hue left to be confused with body text, so the two are told apart by
  shape/underline/weight at each call site instead — a filled button, a
  filled active-nav pill, an explicit `underline` on every inline text
  link). **Individual pages are not restyled beyond this token-level
  change plus the specific non-color-cue fixes this pass made** (see
  git history for the exact list — bucket-filter tiles, settings-registry
  row selection, ~14 links that relied on accent color alone).
- **Typography: no serif in dense UI, ever.** The A3 batch's blanket
  `h1,h2,h3,h4 { font-family: var(--font-display) }` rule (Alegreya SC
  everywhere, including the seller dashboard and admin terminal) is
  reversed. Dashboard/admin/forms/tables/small text are Inter-only,
  hierarchy built from weight/size, never a serif face — shared
  primitives (`PageHeader`, `DialogTitle`, `EmptyState`,
  `UpgradeLockedCard`, `Gauge`'s value text) were edited directly rather
  than relying on the removed blanket rule. The serif voice survives
  ONLY on the marketing site's own hero/display headlines and shared
  marketing components (`SectionTitle`, `PricingCard`, `FeatureCard`,
  `FAQAccordion`, etc.) — each of those already opts in explicitly via
  its own `font-display` className, independent of the rule that was
  removed, so they were unaffected by removing it. The "UZEYN" wordmark
  in `Sidebar.tsx`/`AdminSidebar.tsx`/the store-creation page keeps its
  serif treatment — a brand-mark exception, not a heading.
- **Seller-facing dashboard color personalization is untouched.** Module
  10/FR-28.4's opt-in emerald/amber/rose accent presets (a seller's own
  workspace choice, not the platform's brand identity) still work exactly
  as before — only the platform DEFAULT (before a seller picks one)
  became monochrome, per explicit founder instruction to keep this
  shipped, tested feature rather than remove it for no functional reason.
- **Status colors stay functional, not brand.** Order/verification/
  moderation status colors (`--color-success`/`-warning`/`-danger`/
  `-info`) were never part of any brand-color pass, this one included —
  same "status pills stay distinct, never folded into brand palette"
  rule locked since Phase 1.
- **Buyer-facing storefronts (D-Studio) are out of scope for brand-color
  passes.** A seller's own storefront theme (`lib/theme-presets.ts`,
  `app/storefront/`) is a separate, seller-chosen system per the
  original Phase 1 three-system separation - re-confirmed explicitly in
  scope for the v1.3 monochrome pass as untouched.
- **Branding is dummy until launch.** The platform will be renamed
  before public launch. Keep a typographic placeholder wordmark
  (`Sidebar.tsx`'s `Wordmark()` component is the existing example — see
  its own comment) — no logo design work. **Nothing in new UI copy may
  hard-code the current platform name** where the brand-asset/
  content-page system (SRS FR-12.1/FR-12.3, built Module 17) should
  supply it instead — that system is the actual mechanism for a future
  rebrand to be a data change, not a code change.
- **Plan tier names always carry their subtitle.** GO/RUN/RISE/FLY are
  creative names, not self-explanatory ones — every surface that shows
  one of these four individual-tier names (nav, billing/plan pages,
  plan-gate upsell messaging in any future phase) must pair it with its
  short "who this is for" subtitle via `apps/web/lib/plan-tier-copy.ts`'s
  `planTierSubtitle()` (GO — for new sellers · RUN — for growing stores ·
  RISE — for established sellers · FLY — for high-volume operations).
  Team/Supplier plan names are unaffected — already self-explanatory, no
  subtitle defined for them.
