import { Controller, Get, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { StoreHealthScoreService } from "./store-health-score.service";

/** SRS §5.34, FR-34.3 - the seller dashboard's Store Health Score screen. */
@Controller("stores/:storeId/health")
@UseGuards(JwtAuthGuard)
export class StoreHealthController {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly storeHealth: StoreHealthScoreService,
  ) {}

  @Get()
  async get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    await this.assertOwnership(sellerId, storeId);
    const latest = await this.storeHealth.latestForStore(storeId);
    return {
      score: latest?.score ?? null,
      breakdown: latest?.breakdown ?? null,
      computedAt: latest?.computedAt ?? null,
    };
  }

  @Get("history")
  async history(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    await this.assertOwnership(sellerId, storeId);
    return this.storeHealth.historyForStore(storeId);
  }

  private async assertOwnership(sellerId: string, storeId: string): Promise<void> {
    await this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
    });
  }
}
