import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { UpdateStoreThemeSettingsDto } from "./dto/update-store-theme-settings.dto";
import { validateSections } from "./section-validation";

/**
 * Every method verifies `storeId` belongs to the calling seller before
 * touching `store_theme_settings` - same app-layer discipline as every
 * other tenant service since Module 2 (RLS proves "not another seller's
 * row," not "not my OWN other store's row").
 */
@Injectable()
export class StoreThemeSettingsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async getForStore(sellerId: string, storeId: string) {
    const themeSettings = await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      const themeSettings = await tx.storeThemeSettings.findUnique({
        where: { storeId },
        include: { theme: true },
      });
      if (!themeSettings) {
        throw new NotFoundException("This store has no theme settings - a built-in theme may not have been seeded.");
      }
      return themeSettings;
    });

    // Phase 4 close-out - lets the Customizer render the real coded-mode
    // editor vs. a locked upsell card in one round-trip, same gate
    // update() itself enforces server-side (FR-1.6).
    const context = await this.subscriptions.getPlanContext(sellerId);
    const codedModeEnabled = await this.settings.resolve<boolean>("theme.coded_mode_enabled", context);
    return { ...themeSettings, codedModeEnabled };
  }

  async update(sellerId: string, storeId: string, dto: UpdateStoreThemeSettingsDto) {
    // FR-1.6 (Phase 2 coded-theme escape hatch) - gated by plan at the app
    // layer, resolved through the Settings Registry rather than a hardcoded
    // check, per SRS §3.8. FR-7.16 (Module 14) - bundled as a developer perk
    // on qualifying paid tiers; the real seller->plan context now resolves
    // this correctly instead of always falling through to the `global`
    // default.
    if (dto.customCode !== undefined) {
      const context = await this.subscriptions.getPlanContext(sellerId);
      const codedModeEnabled = await this.settings.resolve<boolean>("theme.coded_mode_enabled", context);
      if (!codedModeEnabled) {
        throw new ForbiddenException("Custom theme code is not enabled for your plan.");
      }
    }

    // D-Studio v1 - real server-side enforcement of the section/variant/
    // animation-preset tier gates (section-catalog.ts), not just a
    // client-hidden UpgradeLockedCard. Runs before the transaction below so
    // a rejected write never partially persists.
    if (dto.settings && typeof dto.settings === "object" && "sections" in dto.settings) {
      const sellerTierOrder = await this.subscriptions.getSellerTierOrder(sellerId);
      validateSections((dto.settings as Record<string, unknown>).sections, sellerTierOrder);
    }

    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      const existing = await tx.storeThemeSettings.findUnique({ where: { storeId } });
      if (!existing) {
        throw new NotFoundException("This store has no theme settings - a built-in theme may not have been seeded.");
      }

      if (dto.themeId) {
        const theme = await tx.theme.findFirst({ where: { id: dto.themeId, isActive: true } });
        if (!theme) throw new NotFoundException("Theme not found or not active.");

        // Module 18 (FR-24.5) - two independent gates, both must pass:
        // `marketplace` requires a live TemplateEntitlement (never gated by
        // plan); `premium` requires the plan-tier gate. Neither check
        // substitutes for the other.
        if (theme.tier === "marketplace") {
          const entitlement = await tx.templateEntitlement.findUnique({
            where: { sellerId_themeId: { sellerId, themeId: theme.id } },
          });
          if (!entitlement || entitlement.revokedAt) {
            throw new ForbiddenException("You don't have a license for this template.");
          }
        } else if (theme.tier === "premium") {
          const context = await this.subscriptions.getPlanContext(sellerId);
          const premiumTierEnabled = await this.settings.resolve<boolean>("theme.premium_tier_enabled", context);
          if (!premiumTierEnabled) {
            throw new ForbiddenException("This template isn't included in your current plan.");
          }
        }
      }

      const updated = await tx.storeThemeSettings.update({
        where: { storeId },
        data: {
          themeId: dto.themeId,
          settings: dto.settings as any,
          customCode: dto.customCode,
        },
        include: { theme: true },
      });

      // Module 16 (FR-20.1) - any real customizer save also satisfies the
      // onboarding wizard's theme step; a seller who actively picks a theme
      // never needs the wizard's separate "keep this theme" ack too.
      if (!store.onboardingThemeAckAt) {
        await tx.store.update({ where: { id: storeId }, data: { onboardingThemeAckAt: new Date() } });
      }

      return updated;
    });
  }
}
