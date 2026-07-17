import { Injectable, NotFoundException } from "@nestjs/common";
import { NavigationLocation } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { UpdateNavigationDto } from "./dto/update-navigation.dto";

/**
 * One row per (store, location) - upserted, never accumulated (FR-16.3).
 */
@Injectable()
export class NavigationService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async get(sellerId: string, storeId: string, location: NavigationLocation) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      const menu = await tx.storeNavigationMenu.findUnique({
        where: { uniq_nav_store_location: { storeId, location } },
      });
      return menu ?? { storeId, location, items: [] };
    });
  }

  async upsert(sellerId: string, storeId: string, location: NavigationLocation, dto: UpdateNavigationDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storeNavigationMenu.upsert({
        where: { uniq_nav_store_location: { storeId, location } },
        create: { storeId, location, items: dto.items as any },
        update: { items: dto.items as any },
      });
    });
  }
}
