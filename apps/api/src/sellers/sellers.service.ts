import { Injectable } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
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
  ) {}

  async getProfile(sellerId: string) {
    const [seller, cnicMasked] = await Promise.all([
      this.prisma.seller.findUniqueOrThrow({
        where: { id: sellerId },
        select: { dashboardTheme: true, activationStatus: true, lifecycleStatus: true },
      }),
      this.identity.getMaskedCnic(sellerId),
    ]);
    // SRS §5.30/FR-30.1 - the plaintext CNIC is never returned from any API;
    // this masked (last-4) form is the only view the seller ever sees.
    return { ...seller, cnicMasked };
  }

  async updateDashboardTheme(sellerId: string, dashboardTheme: string) {
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { dashboardTheme },
      select: { dashboardTheme: true },
    });
  }
}
