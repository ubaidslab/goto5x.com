import { atelierSections } from "./atelier";
import { baseSections } from "./base";
import { editorialSections } from "./editorial";
import { marketSections } from "./market";
import { studioSections } from "./studio";
import { TemplateSectionSet } from "./types";

/**
 * Template Package Spec (docs/architecture.md) - name -> component-set
 * mapping. The storefront page (app/storefront/page.tsx) and the
 * customizer's live preview (app/(dashboard)/stores/[storeId]/customizer/
 * page.tsx) both call this SAME function, so "live preview output matches
 * published output exactly" (SRS §14.1) holds by construction - one lookup,
 * not two copies that could drift.
 *
 * THE ISOLATION RULE, enforced here structurally: every value in this map
 * is a `TemplateSectionSet` (types.ts) - pure presentational components
 * receiving already-fetched display data as props. None of them import
 * from, or can reach, cart/checkout/order-status/wallet/verification code -
 * that machinery lives entirely outside this `templates/` directory, in
 * its own page trees (app/storefront/cart, /checkout, /order-status, the
 * dashboard's wallet/order-verification screens). scripts/
 * check-template-isolation.js statically enforces this boundary in CI: no
 * file under this directory may import from those paths, full stop.
 */
const REGISTRY: Record<string, TemplateSectionSet> = {
  Editorial: editorialSections,
  Studio: studioSections,
  Market: marketSections,
  Atelier: atelierSections,
  "Start from blank": baseSections,
};

export function getTemplateSections(themeName: string): TemplateSectionSet {
  return REGISTRY[themeName] ?? baseSections;
}
