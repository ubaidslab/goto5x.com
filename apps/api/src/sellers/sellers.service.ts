import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { SellerIdentityService } from "../trust-safety/seller-identity.service";

/**
 * Seller-global profile (not store-scoped, so no TenantPrismaService/RLS
 * transaction needed - same direct-Prisma pattern AuthService already uses
 * for `sellers` table reads).
 */
@Injectable()
export class SellersService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly identity: SellerIdentityService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async getProfile(sellerId: string) {
    const [seller, cnicMasked] = await Promise.all([
      this.prisma.seller.findUniqueOrThrow({
        where: { id: sellerId },
        select: {
          dashboardTheme: true,
          activationStatus: true,
          lifecycleStatus: true,
          user: { select: { mfaEnabled: true } },
        },
      }),
      this.identity.getMaskedCnic(sellerId),
    ]);
    // SRS §5.30/FR-30.1 - the plaintext CNIC is never returned from any API;
    // this masked (last-4) form is the only view the seller ever sees.
    // SRS §5.25/FR-25.6 - mfaEnabled flattened from the User relation so the
    // dashboard can show 2FA status without a second request.
    const { user, ...rest } = seller;
    return { ...rest, cnicMasked, mfaEnabled: user.mfaEnabled };
  }

  /**
   * SRS §5.28/FR-28.4 - plan-gated (Module 14 cross-check, closing the open
   * item carried since Module 10: "no real seller->plan assignment existed
   * until now"). The global default (any plan with no override) is the
   * small built-in set; higher tiers override with more options via the
   * same Settings Registry mechanism FR-7.1 already uses for template
   * tiers.
   */
  async updateDashboardTheme(sellerId: string, dashboardTheme: string) {
    const context = await this.subscriptions.getPlanContext(sellerId);
    const allowedThemes = await this.settings.resolve<string[]>("dashboard.personalization_allowed_themes", context);
    if (!allowedThemes.includes(dashboardTheme)) {
      throw new ForbiddenException("This dashboard theme is not available on your plan.");
    }
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { dashboardTheme },
      select: { dashboardTheme: true },
    });
  }
}
