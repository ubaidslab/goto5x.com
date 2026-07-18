import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * SRS §5.23/FR-23.5 - a per-identity limit on the number of Free-Plan
 * stores one verified identity (cnic_hash) can create. Uses
 * PrismaAdminService deliberately: this check must see every seller
 * sharing the same identity, not just the calling seller's own tenant
 * scope - the exact same cross-tenant read pattern already established for
 * uniqueness checks in Module 12 (cnic_hash itself).
 */
@Injectable()
export class FreeStoreLimitService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  async enforce(sellerId: string): Promise<void> {
    const seller = await this.prismaAdmin.seller.findUniqueOrThrow({
      where: { id: sellerId },
      include: { subscription: { include: { plan: true } } },
    });
    const isOnFreePlan = seller.subscription
      ? seller.subscription.plan.planGroup === "individual" && seller.subscription.plan.tierOrder === 0
      : true; // no subscription row yet (shouldn't happen post-signup) - treat as Free, the safer default

    if (!isOnFreePlan) return;

    const limit = await this.settings.resolve<number>("plans.free_store_limit_per_identity");

    // No verified identity yet (CNIC not saved) - only this seller's own
    // stores can be correlated to "one identity" so far.
    const sellerIds = seller.cnicHash
      ? (await this.prismaAdmin.seller.findMany({ where: { cnicHash: seller.cnicHash }, select: { id: true } })).map(
          (s) => s.id,
        )
      : [sellerId];

    const freeStoreCount = await this.prismaAdmin.store.count({
      where: {
        sellerId: { in: sellerIds },
        seller: { subscription: { plan: { planGroup: "individual", tierOrder: 0 } } },
      },
    });

    if (freeStoreCount >= limit) {
      throw new BadRequestException(
        `This identity has reached its limit of ${limit} Free-Plan store(s). Upgrade to create another.`,
      );
    }
  }
}
