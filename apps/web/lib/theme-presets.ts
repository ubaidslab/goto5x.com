/**
 * FR-1.1/FR-1.2 (v1.0) - three structurally distinct built-in templates
 * (different default section ordering/color scheme), not three fully
 * bespoke hand-designed visual templates. True premium-bar visual design
 * is gated on branding assets not yet delivered (see
 * apps/api/src/theme-engine/themes.seed.ts's doc comment) - disclosed
 * transparently, not silently substituted for the real thing.
 *
 * A bounded token set only (SRS Risk Register #10): colors + a fixed list
 * of section ids or a customizer would become an open-ended visual builder.
 */
export type SectionId = "hero" | "featured_products" | "about" | "newsletter";

export interface ThemeSection {
  id: SectionId;
  visible: boolean;
}

export interface ThemeColors {
  primary: string;
  background: string;
  text: string;
}

export interface ThemeSettings {
  colors?: Partial<ThemeColors>;
  sections?: ThemeSection[];
  logoUrl?: string;
  bannerUrl?: string;
}

export interface ResolvedThemeSettings {
  colors: ThemeColors;
  sections: ThemeSection[];
  logoUrl?: string;
  bannerUrl?: string;
}

const THEME_PRESETS: Record<string, { colors: ThemeColors; sections: ThemeSection[] }> = {
  Classic: {
    colors: { primary: "#1d4ed8", background: "#ffffff", text: "#111827" },
    sections: [
      { id: "hero", visible: true },
      { id: "featured_products", visible: true },
      { id: "about", visible: true },
      { id: "newsletter", visible: true },
    ],
  },
  Modern: {
    colors: { primary: "#db2777", background: "#0f172a", text: "#f8fafc" },
    sections: [
      { id: "featured_products", visible: true },
      { id: "hero", visible: true },
      { id: "newsletter", visible: true },
      { id: "about", visible: false },
    ],
  },
  Minimal: {
    colors: { primary: "#111827", background: "#fafafa", text: "#111827" },
    sections: [
      { id: "hero", visible: true },
      { id: "featured_products", visible: true },
      { id: "about", visible: false },
      { id: "newsletter", visible: false },
    ],
  },
};

export const ALL_SECTION_IDS: SectionId[] = ["hero", "featured_products", "about", "newsletter"];

export function resolveThemeSettings(themeName: string, overrides: ThemeSettings | null | undefined): ResolvedThemeSettings {
  const preset = THEME_PRESETS[themeName] ?? THEME_PRESETS.Classic;
  return {
    colors: { ...preset.colors, ...(overrides?.colors ?? {}) },
    sections: overrides?.sections && overrides.sections.length > 0 ? overrides.sections : preset.sections,
    logoUrl: overrides?.logoUrl,
    bannerUrl: overrides?.bannerUrl,
  };
}
