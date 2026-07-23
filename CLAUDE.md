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

- **Monochrome premium.** Near-white surfaces, near-black ink, a
  grayscale scale between; **at most one** restrained accent, used
  sparingly (links, the primary CTA) — apple.com discipline, horizonx.so
  motion.
- **Tokens are the single source of truth**
  (`apps/web/app/globals.css`'s `@theme` block). The neutral scale
  (`--color-canvas`/`--color-surface`/`--color-border`/`--color-ink`…)
  was already a true grayscale and needed no change. The accent was
  changed from a saturated violet/indigo to a restrained,
  apple.com-style blue (`--color-accent: #0071e3`, mirrored in the
  dark-mode block) — still a placeholder pending the founder's real
  design pass, but establishing the "exactly one restrained accent"
  discipline at the token level. **Individual pages are not restyled by
  this policy** — everything currently using these tokens inherits the
  direction automatically; a page-by-page pass is separate, future work.
- **Branding is dummy until launch.** The platform will be renamed
  before public launch. Keep a typographic placeholder wordmark
  (`Sidebar.tsx`'s `Wordmark()` component is the existing example — see
  its own comment) — no logo design work. **Nothing in new UI copy may
  hard-code the current platform name** where the brand-asset/
  content-page system (SRS FR-12.1/FR-12.3, built Module 17) should
  supply it instead — that system is the actual mechanism for a future
  rebrand to be a data change, not a code change.
