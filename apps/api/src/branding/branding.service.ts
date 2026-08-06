import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * Templates module (v0.31 design phase) - the "Managed by UZEYN"
 * storefront mark. Founder-mandated invariant: mandatory on First
 * Month/Starter/Growth (the platform's own free organic marketing),
 * removable only once the seller reaches Pro (v0.33 - see themes.seed.ts's
 * seedTemplatesBrandingSettings doc comment). Two settings keys, resolved
 * independently so a downgrade off Pro always reverts to showing the mark,
 * regardless of what the seller previously chose - `getVisibility()` below
 * is the one place that combines them, and it never trusts the stored
 * preference alone.
 */
@Injectable()
export class BrandingService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private async assertOwnsStore(sellerId: string, storeId: string): Promise<void> {
    await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
    });
  }

  /** The seller-facing view: their own store's preference plus whether their current plan actually honors it. */
  async getForStore(sellerId: string, storeId: string) {
    await this.assertOwnsStore(sellerId, storeId);
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const [removable, hidden] = await Promise.all([
      this.settings.resolve<boolean>("branding.powered_by_removable", planContext),
      this.settings.resolve<boolean>("branding.powered_by_hidden", { storeId }),
    ]);
    return { removable, hidden, visible: !(removable && hidden) };
  }

  async setHiddenForStore(sellerId: string, storeId: string, userId: string, hidden: boolean) {
    await this.assertOwnsStore(sellerId, storeId);
    if (hidden) {
      const planContext = await this.subscriptions.getPlanContext(sellerId);
      const removable = await this.settings.resolve<boolean>("branding.powered_by_removable", planContext);
      if (!removable) {
        throw new ForbiddenException("Removing the UZEYN mark isn't included in your current plan.");
      }
    }
    await this.settings.setValue("branding.powered_by_hidden", "store", storeId, hidden, userId);
    return this.getForStore(sellerId, storeId);
  }

  /**
   * The public storefront's read path (anonymous buyer, no seller session) -
   * same BYPASSRLS reasoning as StorefrontService's own methods (a store's
   * seller/plan lookup here is never seller-scoped, since there is no
   * seller session to scope it to). Fails open to "visible" on any lookup
   * gap (e.g. a malformed storeId) - the mark showing is never a functional
   * break, unlike a checkout failing open would be.
   */
  async getVisibleForStorefront(storeId: string): Promise<boolean> {
    const store = await this.prismaAdmin.store.findUnique({ where: { id: storeId } });
    if (!store) return true;
    const planContext = await this.subscriptions.getPlanContext(store.sellerId);
    const [removable, hidden] = await Promise.all([
      this.settings.resolve<boolean>("branding.powered_by_removable", planContext),
      this.settings.resolve<boolean>("branding.powered_by_hidden", { storeId }),
    ]);
    return !(removable && hidden);
  }
}
