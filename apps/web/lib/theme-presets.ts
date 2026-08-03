/**
 * FR-1.1/FR-1.2 - four genuinely distinct, hand-designed built-in
 * templates (Editorial/Studio/Market/Atelier - see docs/architecture.md's
 * Template Package Spec) plus a "Start from blank" utility option (empty
 * section list; the seller composes from scratch using the same bounded
 * customizer, never a different/freer system - FR-1.6's coded-mode escape
 * hatch is the actual free-form builder, deliberately still deferred).
 *
 * Colors here are each template's default palette; the real visual
 * distinctiveness (typography, spacing, imagery treatment) lives in each
 * template's own section-component set (apps/web/app/storefront/templates/)
 * - see that directory's registry.ts for the name -> component-set mapping
 * this file's presets are paired with.
 *
 * A bounded token set only (SRS Risk Register #10): colors + a fixed list
 * of section ids or a customizer would become an open-ended visual builder.
 */
export type SectionId = "hero" | "featured_products" | "about" | "newsletter" | "faq";

export interface ThemeSection {
  id: SectionId;
  visible: boolean;
}

export interface ThemeColors {
  primary: string;
  background: string;
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

// FR-16.4/FR-16.7 (Module 5) - both explicitly "a Theme Engine customizer
// setting" per SRS, not a new content system, so they extend this same
// settings JSON blob rather than getting their own table.
export interface AnnouncementBarSettings {
  enabled: boolean;
  message: string;
}

export interface WhatsappSettings {
  enabled: boolean;
  phoneNumber: string;
}

export interface ThemeSettings {
  colors?: Partial<ThemeColors>;
  sections?: ThemeSection[];
  logoUrl?: string;
  bannerUrl?: string;
  announcementBar?: AnnouncementBarSettings;
  whatsapp?: WhatsappSettings;
  faqItems?: FaqItem[];
}

export interface ResolvedThemeSettings {
  colors: ThemeColors;
  sections: ThemeSection[];
  logoUrl?: string;
  bannerUrl?: string;
  announcementBar?: AnnouncementBarSettings;
  whatsapp?: WhatsappSettings;
  faqItems: FaqItem[];
}

const THEME_PRESETS: Record<string, { colors: ThemeColors; sections: ThemeSection[] }> = {
  // Editorial - serif display type, generous whitespace, lifestyle
  // photography treatment. Default free template (sortOrder 0).
  Editorial: {
    colors: { primary: "#9a3412", background: "#fdfaf6", text: "#1c1917" },
    sections: [
      { id: "hero", visible: true },
      { id: "featured_products", visible: true },
      { id: "about", visible: true },
      { id: "newsletter", visible: true },
    ],
  },
  // Studio - geometric/grotesque sans, bold color-blocking, confident
  // large type. Premium template.
  Studio: {
    colors: { primary: "#db2777", background: "#0f172a", text: "#f8fafc" },
    sections: [
      { id: "featured_products", visible: true },
      { id: "hero", visible: true },
      { id: "newsletter", visible: true },
      { id: "about", visible: false },
    ],
  },
  // Market - denser grid, utilitarian, optimized for scanning many SKUs.
  // Premium template.
  Market: {
    colors: { primary: "#15803d", background: "#f7f7f5", text: "#18181b" },
    sections: [
      { id: "featured_products", visible: true },
      { id: "hero", visible: true },
      { id: "about", visible: false },
      { id: "newsletter", visible: false },
    ],
  },
  // Atelier - monochrome, minimal, restrained single accent (apple.com
  // discipline). Free template.
  Atelier: {
    colors: { primary: "#111827", background: "#fafafa", text: "#111827" },
    sections: [
      { id: "hero", visible: true },
      { id: "featured_products", visible: true },
      { id: "about", visible: false },
      { id: "newsletter", visible: false },
    ],
  },
  // Start from blank - every section starts hidden; the seller composes
  // from scratch using the same bounded customizer. Deliberately empty,
  // not a smaller version of another template's layout.
  "Start from blank": {
    colors: { primary: "#111827", background: "#ffffff", text: "#111827" },
    sections: [],
  },
};

export const ALL_SECTION_IDS: SectionId[] = ["hero", "featured_products", "about", "newsletter", "faq"];

export function resolveThemeSettings(themeName: string, overrides: ThemeSettings | null | undefined): ResolvedThemeSettings {
  const preset = THEME_PRESETS[themeName] ?? THEME_PRESETS.Editorial;
  return {
    colors: { ...preset.colors, ...(overrides?.colors ?? {}) },
    sections: overrides?.sections && overrides.sections.length > 0 ? overrides.sections : preset.sections,
    logoUrl: overrides?.logoUrl,
    bannerUrl: overrides?.bannerUrl,
    announcementBar: overrides?.announcementBar,
    whatsapp: overrides?.whatsapp,
    faqItems: overrides?.faqItems ?? [],
  };
}
