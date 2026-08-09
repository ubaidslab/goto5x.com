import { ConfigService } from "@nestjs/config";
import { Injectable, NotFoundException } from "@nestjs/common";
import { EmailService } from "../notifications/email.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
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
    private readonly prismaAdmin: PrismaAdminService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
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
          trackInventory: v.trackInventory,
          isLowStock: v.trackInventory && v.stockQuantity <= threshold,
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
    }).then(async (updated) => {
      await this.checkAndAlertLowStock(variantId).catch(() => undefined);
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

  /**
   * Module 55 (SRS §5.62/FR-62.1) - wires this module's own isLowStock
   * computation to an actual email trigger, debounced by
   * ProductVariant.lowStockAlertSentAt so a seller gets exactly one alert
   * per dip below threshold, not one per subsequent sale while it stays
   * low; cleared the instant a restock brings it back above threshold, so
   * the next dip alerts again. Called from both this service's own
   * adjustStock() and CheckoutService's self-fulfilled decrement path -
   * uses prismaAdmin (not the tenant-scoped tx) since it's a system-
   * triggered side effect that needs to read across the seller/store
   * relation the checkout caller doesn't otherwise have open.
   */
  async checkAndAlertLowStock(variantId: string): Promise<void> {
    const variant = await this.prismaAdmin.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { title: true } } },
    });
    if (!variant || !variant.trackInventory) return;

    const threshold = await this.settings.resolve<number>("inventory.low_stock_threshold", { storeId: variant.storeId });
    const isLowStock = variant.stockQuantity <= threshold;

    if (!isLowStock) {
      if (variant.lowStockAlertSentAt) {
        await this.prismaAdmin.productVariant.update({ where: { id: variantId }, data: { lowStockAlertSentAt: null } });
      }
      return;
    }

    if (variant.lowStockAlertSentAt) return; // already alerted for this dip

    const store = await this.prismaAdmin.store.findUnique({ where: { id: variant.storeId } });
    if (!store) return;
    const seller = await this.prismaAdmin.seller.findUnique({ where: { id: store.sellerId }, include: { user: true } });
    if (!seller) return;

    await this.prismaAdmin.productVariant.update({ where: { id: variantId }, data: { lowStockAlertSentAt: new Date() } });
    await this.email.sendLowStockAlertEmail(
      seller.user.email,
      store.name,
      variant.product.title,
      variant.sku,
      variant.stockQuantity,
      threshold,
      `${this.config.getOrThrow<string>("APP_BASE_URL")}/stores/${store.id}/inventory`,
    );
  }
}
