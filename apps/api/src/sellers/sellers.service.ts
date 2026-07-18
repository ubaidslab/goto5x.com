import { Injectable } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";

/**
 * Seller-global profile (not store-scoped, so no TenantPrismaService/RLS
 * transaction needed - same direct-Prisma pattern AuthService already uses
 * for `sellers` table reads).
 */
@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async getProfile(sellerId: string) {
    return this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { dashboardTheme: true },
    });
  }

  async updateDashboardTheme(sellerId: string, dashboardTheme: string) {
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { dashboardTheme },
      select: { dashboardTheme: true },
    });
  }
}
