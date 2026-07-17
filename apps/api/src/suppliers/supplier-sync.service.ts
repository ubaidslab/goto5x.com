import { Injectable, Logger } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { PrintifyAdapter } from "./printify/printify.adapter";

/**
 * FR-4.3 - price/stock sync with graceful degradation: a supplier or
 * adapter-network failure is caught and logged per-supplier, never thrown
 * for the whole batch, so one bad sync never blocks every other supplier's
 * (stale-but-available data instead of a broken storefront).
 *
 * v1.0 only has one adapter (Printify, FR-4.1), so this directly injects
 * `PrintifyAdapter` rather than a generic adapter-type-to-implementation
 * registry lookup - that indirection is deferred until a second adapter
 * (CJ Dropshipping, Phase 1.1, FR-4.2) actually exists to justify it.
 */
@Injectable()
export class SupplierSyncService {
  private readonly logger = new Logger(SupplierSyncService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly printifyAdapter: PrintifyAdapter,
  ) {}

  async syncAllEnabledAdapters(): Promise<{ synced: number; failed: number }> {
    const printifyRegistry = await this.prismaAdmin.supplierAdapter.findUnique({
      where: { adapterType: "printify" },
    });
    if (!printifyRegistry?.isEnabled) {
      this.logger.log("Printify adapter is disabled or not registered - skipping sync.");
      return { synced: 0, failed: 0 };
    }

    const suppliers = await this.prismaAdmin.supplier.findMany({
      where: { printifyShopId: { not: null } },
    });

    let synced = 0;
    let failed = 0;
    for (const supplier of suppliers) {
      try {
        const products = await this.printifyAdapter.syncStock(supplier.id);
        for (const product of products) {
          await this.prismaAdmin.supplierListing.upsert({
            where: {
              uniq_supplier_listing_external: { supplierId: supplier.id, externalProductId: product.externalProductId },
            },
            create: {
              supplierId: supplier.id,
              adapterType: "printify",
              externalProductId: product.externalProductId,
              title: product.title,
              price: product.price,
              shippingCost: product.shippingCost,
              estimatedDeliveryMinDays: product.estimatedDeliveryMinDays,
              estimatedDeliveryMaxDays: product.estimatedDeliveryMaxDays,
              supportedCountries: product.supportedCountries,
              rawPayload: product.rawPayload as any,
            },
            update: {
              title: product.title,
              price: product.price,
              shippingCost: product.shippingCost,
              estimatedDeliveryMinDays: product.estimatedDeliveryMinDays,
              estimatedDeliveryMaxDays: product.estimatedDeliveryMaxDays,
              supportedCountries: product.supportedCountries,
              rawPayload: product.rawPayload as any,
            },
          });
        }
        synced++;
      } catch (err) {
        failed++;
        // FR-4.3 - the storefront keeps serving this supplier's last-known
        // synced data; this failure never propagates or blocks the batch.
        this.logger.error(
          `Supplier sync failed for supplier ${supplier.id} - keeping last-known cached listings.`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
    return { synced, failed };
  }
}
