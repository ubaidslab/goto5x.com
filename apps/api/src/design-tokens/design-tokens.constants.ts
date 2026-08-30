/**
 * Module 92 (SRS §5.68/FR-68.1) - single source of truth for the 13 core
 * neutral/accent Settings Registry keys this module manages, shared by the
 * seed script and both controllers so the key list, its CSS variable
 * mapping, and the seeded default (which must match apps/web/app/globals.css's
 * `@theme` block exactly, or the admin UI's "current effective value" would
 * lie about what an unconfigured token actually renders as) never drift
 * apart into three separately-maintained lists.
 *
 * Light mode, global scope only - see the SRS entry for why dark mode and
 * the semantic/status colors are explicitly out of scope for this pass.
 */
export interface DesignTokenDef {
  /** Settings Registry key, e.g. "design.color.canvas". */
  key: string;
  /** The CSS custom property it maps to 1:1, e.g. "--color-canvas". */
  cssVar: string;
  /** Admin-UI display name. */
  label: string;
  /** Must match globals.css's current @theme value for this token. */
  defaultValue: string;
  description: string;
}

export const DESIGN_TOKENS: DesignTokenDef[] = [
  { key: "design.color.canvas", cssVar: "--color-canvas", label: "Canvas", defaultValue: "#fbf5dd", description: "The lightest background - the page's own base color." },
  { key: "design.color.surface", cssVar: "--color-surface", label: "Surface", defaultValue: "#fdfaee", description: "Card/panel background, one step up from canvas." },
  { key: "design.color.surface_raised", cssVar: "--color-surface-raised", label: "Surface raised", defaultValue: "#ffffff", description: "Modal/dropdown/tooltip background - the highest-elevation surface." },
  { key: "design.color.border", cssVar: "--color-border", label: "Border", defaultValue: "#f1ebc7", description: "Hairline dividers and default input borders." },
  { key: "design.color.border_strong", cssVar: "--color-border-strong", label: "Border strong", defaultValue: "#e7e1b1", description: "A more visible border/divider, and the tonal-card differentiation shade." },
  { key: "design.color.ink", cssVar: "--color-ink", label: "Ink", defaultValue: "#0a0a0a", description: "Primary body text and headings. Must always read as a true neutral, never the accent hue - see this module's own motivating incident." },
  { key: "design.color.ink_muted", cssVar: "--color-ink-muted", label: "Ink muted", defaultValue: "#5f5c56", description: "Secondary/muted body text - captions, helper text." },
  { key: "design.color.ink_faint", cssVar: "--color-ink-faint", label: "Ink faint", defaultValue: "#7a766e", description: "De-emphasized text/icons - large text or UI only, never long-form body copy." },
  { key: "design.color.accent", cssVar: "--color-accent", label: "Accent", defaultValue: "#0d530e", description: "THE one restrained interactive color - primary buttons, links, active nav state, focus rings. Never applied to body text." },
  { key: "design.color.accent_hover", cssVar: "--color-accent-hover", label: "Accent hover", defaultValue: "#306d29", description: "Accent's hover state." },
  { key: "design.color.accent_active", cssVar: "--color-accent-active", label: "Accent active", defaultValue: "#093a0a", description: "Accent's pressed/active state." },
  { key: "design.color.accent_subtle", cssVar: "--color-accent-subtle", label: "Accent subtle", defaultValue: "#dee2c4", description: "A low-emphasis accent tint - selected-row backgrounds, subtle highlight chips." },
  { key: "design.color.on_accent", cssVar: "--color-on-accent", label: "On accent", defaultValue: "#ffffff", description: "Text/icon color rendered on top of an accent-filled surface (e.g. a primary button's label)." },
];

export const DESIGN_TOKEN_KEYS = DESIGN_TOKENS.map((t) => t.key);

export function findDesignToken(key: string): DesignTokenDef | undefined {
  return DESIGN_TOKENS.find((t) => t.key === key);
}
