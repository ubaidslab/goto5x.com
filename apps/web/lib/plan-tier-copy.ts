/**
 * Founder-directed clarification (pre-Phase-3): GO/RUN/RISE/FLY are creative
 * tier names, not self-explanatory ones - every place a seller sees one of
 * these four individual-tier names, it carries a short "who this is for"
 * subtitle so the naming never costs a seller a moment of confusion about
 * which tier fits them. Scoped to the four seller-facing individual tiers
 * only - Team/Supplier plan names (e.g. "Supplier Premium") are already
 * self-explanatory and get no subtitle.
 */
export const PLAN_TIER_SUBTITLE: Record<string, string> = {
  GO: "for new sellers",
  RUN: "for growing stores",
  RISE: "for established sellers",
  FLY: "for high-volume operations",
};

export function planTierSubtitle(planName: string): string | null {
  return PLAN_TIER_SUBTITLE[planName] ?? null;
}
