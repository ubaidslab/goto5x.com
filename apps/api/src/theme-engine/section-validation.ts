import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ALL_ANIMATION_IDS, ALL_SECTION_IDS, ANIMATION_CATALOG, AnimationId, SECTION_CATALOG, SectionId } from "./section-catalog";

const TIER_NAMES = ["GO", "RUN", "RISE", "FLY"];

/**
 * D-Studio v1 - the real per-section-type, per-variant, and per-element-
 * animation server-side enforcement that the pre-D-Studio customizer never
 * had (StoreThemeSettings.settings was, and remains, an untyped JSON blob -
 * see docs/ui-feature-inventory.md's "Known engineering gaps" note on this
 * exact prototype). Called from StoreThemeSettingsService.update() whenever
 * `settings.sections` is present in the incoming payload; a malformed shape
 * is a 400 (client bug), a tier violation is a 403 naming the section/
 * preset and the tier it actually requires (same UX contract as every other
 * plan-gated write in this codebase).
 */
export function validateSections(rawSections: unknown, sellerTierOrder: number): void {
  if (rawSections === undefined) return;
  if (!Array.isArray(rawSections)) {
    throw new BadRequestException("settings.sections must be an array.");
  }

  for (const raw of rawSections) {
    if (typeof raw !== "object" || raw === null) {
      throw new BadRequestException("Each section entry must be an object.");
    }
    const entry = raw as Record<string, unknown>;

    if (typeof entry.id !== "string" || !ALL_SECTION_IDS.includes(entry.id as SectionId)) {
      throw new BadRequestException(`Unknown section id: ${String(entry.id)}.`);
    }
    const id = entry.id as SectionId;
    const catalog = SECTION_CATALOG[id];

    if (entry.visible !== undefined && typeof entry.visible !== "boolean") {
      throw new BadRequestException(`Section "${id}": visible must be a boolean.`);
    }

    if (catalog.tierFloor > sellerTierOrder) {
      throw new ForbiddenException(
        `The "${id}" section requires the ${TIER_NAMES[catalog.tierFloor]} plan or above - you're on ${TIER_NAMES[sellerTierOrder]}.`,
      );
    }

    const variant = entry.variant === undefined ? 0 : entry.variant;
    if (typeof variant !== "number" || !Number.isInteger(variant) || variant < 0 || variant >= catalog.variantCount) {
      throw new BadRequestException(`Section "${id}": variant must be an integer between 0 and ${catalog.variantCount - 1}.`);
    }
    const maxAllowedIndex = sellerTierOrder >= 2 ? catalog.variantCount - 1 : catalog.maxVariantIndexByTier[Math.min(sellerTierOrder, 1)];
    if (variant > maxAllowedIndex) {
      throw new ForbiddenException(`That layout variant for "${id}" requires a higher plan tier than ${TIER_NAMES[sellerTierOrder]}.`);
    }

    if (entry.elementAnimations !== undefined) {
      if (typeof entry.elementAnimations !== "object" || entry.elementAnimations === null || Array.isArray(entry.elementAnimations)) {
        throw new BadRequestException(`Section "${id}": elementAnimations must be an object.`);
      }
      for (const [slot, animationId] of Object.entries(entry.elementAnimations as Record<string, unknown>)) {
        if (typeof animationId !== "string" || !ALL_ANIMATION_IDS.includes(animationId as AnimationId)) {
          throw new BadRequestException(`Section "${id}", element "${slot}": unknown animation preset "${String(animationId)}".`);
        }
        const animTierFloor = ANIMATION_CATALOG[animationId as AnimationId].tierFloor;
        if (animTierFloor > sellerTierOrder) {
          throw new ForbiddenException(
            `The "${animationId}" animation preset requires the ${TIER_NAMES[animTierFloor]} plan or above - you're on ${TIER_NAMES[sellerTierOrder]}.`,
          );
        }
      }
    }
  }
}
