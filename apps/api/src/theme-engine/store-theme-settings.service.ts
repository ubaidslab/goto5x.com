import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { UpdateStoreThemeSettingsDto } from "./dto/update-store-theme-settings.dto";

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
    return this.tenantPrisma.run(sellerId, async (tx) => {
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

      return tx.storeThemeSettings.update({
        where: { storeId },
        data: {
          themeId: dto.themeId,
          settings: dto.settings as any,
          customCode: dto.customCode,
        },
        include: { theme: true },
      });
    });
  }
}
