import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { UpdateTaxSettingsDto } from "./dto/update-tax-settings.dto";

/**
 * SRS FR-19.3. `store_tax_settings` is auto-created (sensible v1.0 defaults)
 * the moment a store is created (StoresService.create()) - same "row always
 * exists" discipline as ShippingSettingsService. The actual tax computation
 * at checkout and invoice itemization are Modules 9/14's job; this service
 * only manages the seller-configured input those later modules will read.
 */
@Injectable()
export class TaxSettingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getForStore(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storeTaxSettings.findUniqueOrThrow({ where: { storeId } });
    });
  }

  async update(sellerId: string, storeId: string, dto: UpdateTaxSettingsDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storeTaxSettings.update({ where: { storeId }, data: dto });
    });
  }
}
