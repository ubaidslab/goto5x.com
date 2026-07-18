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

  async updateDashboardTheme(sellerId: string, dashboardTheme: string) {
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { dashboardTheme },
      select: { dashboardTheme: true },
    });
  }
}
