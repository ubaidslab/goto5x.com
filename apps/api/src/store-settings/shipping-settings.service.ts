import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { UpdateShippingSettingsDto } from "./dto/update-shipping-settings.dto";

/**
 * SRS FR-2.10. `store_shipping_settings` is auto-created (sensible v1.0
 * defaults) the moment a store is created (StoresService.create()), so
 * every method here can assume the row exists - no "no settings yet" state
 * to handle, same discipline as StoreThemeSettingsService.
 */
@Injectable()
export class ShippingSettingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getForStore(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storeShippingSettings.findUniqueOrThrow({ where: { storeId } });
    });
  }

  async update(sellerId: string, storeId: string, dto: UpdateShippingSettingsDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storeShippingSettings.update({ where: { storeId }, data: dto });
    });
  }
}
