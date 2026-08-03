import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * SRS §5.39, FR-39.1/39.2/39.4 - a dedicated read/adjust surface over the
 * existing `ProductVariant.stockQuantity` field. Deliberately does not
 * touch checkout's oversell-protection decrement logic (FR-39.5) - this
 * service only reads that field and, on manual adjustment, writes it plus
 * an append-only `StockAdjustment` row, the same field checkout already
 * decrements on its own, separate code path.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** FR-39.1/39.2 - every variant's stock level, flagged low-stock per the store's threshold. */
  async listInventory(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const threshold = await this.settings.resolve<number>("inventory.low_stock_threshold", { storeId });

      const variants = await tx.productVariant.findMany({
        where: { storeId },
        include: { product: { select: { id: true, title: true, status: true } } },
        orderBy: { sku: "asc" },
      });

      return {
        lowStockThreshold: threshold,
        variants: variants.map((v) => ({
          variantId: v.id,
          productId: v.productId,
          productTitle: v.product.title,
          productStatus: v.product.status,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          isLowStock: v.stockQuantity <= threshold,
        })),
      };
    });
  }

  /** FR-39.4 - a single-row manual stock change, always logged. */
  async adjustStock(
    sellerId: string,
    storeId: string,
    variantId: string,
    userId: string,
    input: { type: "increment" | "decrement" | "set"; amount: number; reason: string },
  ) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.storeId !== storeId) throw new NotFoundException("Variant not found.");

      const before = variant.stockQuantity;
      const after =
        input.type === "increment"
          ? before + input.amount
          : input.type === "decrement"
            ? Math.max(0, before - input.amount)
            : input.amount;

      const updated = await tx.productVariant.update({ where: { id: variantId }, data: { stockQuantity: after } });
      await tx.stockAdjustment.create({
        data: {
          storeId,
          productVariantId: variantId,
          adjustedByUserId: userId,
          quantityBefore: before,
          quantityAfter: after,
          reason: input.reason,
        },
      });

      return updated;
    });
  }

  /** FR-39.4 - the append-only adjustment history for one variant. */
  async listAdjustments(sellerId: string, storeId: string, variantId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.storeId !== storeId) throw new NotFoundException("Variant not found.");
      return tx.stockAdjustment.findMany({ where: { productVariantId: variantId }, orderBy: { createdAt: "desc" } });
    });
  }
}
