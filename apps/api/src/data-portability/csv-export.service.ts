import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectStorageService } from "../media/object-storage.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { toCsv } from "./csv.util";

const PRODUCT_EXPORT_HEADER = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Variant SKU",
  "Variant Price",
  "Variant Inventory Qty",
  "Image Src",
];

const ORDER_EXPORT_HEADER = [
  "Order ID",
  "Placed At",
  "Status",
  "Buyer Email",
  "Currency",
  "Subtotal",
  "Discount Amount",
  "Shipping Amount",
  "Tax Amount",
  "Total Amount",
];

function slugifyHandle(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug}-${id.slice(0, 8)}`;
}

/**
 * FR-18.3 - a seller's own data, exported for their own records or to move
 * to another platform; the product format is the same core-field shape
 * ProductImportService reads back, so a self-export round-trips through
 * this platform's own importer.
 */
@Injectable()
export class CsvExportService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async exportProducts(sellerId: string, storeId: string): Promise<string> {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const products = await tx.product.findMany({
        where: { storeId },
        include: { variants: true, media: { orderBy: { sortOrder: "asc" } } },
      });

      const rows: (string | number)[][] = [];
      for (const product of products) {
        const handle = slugifyHandle(product.title, product.id);
        const variantRows: (typeof product.variants)[number][] = product.variants.length > 0 ? product.variants : [];
        const rowCount = Math.max(variantRows.length, 1);

        for (let i = 0; i < rowCount; i++) {
          const variant = variantRows[i];
          const attrs = (variant?.attributes as Record<string, string>) ?? {};
          const keys = Object.keys(attrs);
          rows.push([
            handle,
            i === 0 ? product.title : "",
            i === 0 ? (product.description ?? "") : "",
            keys[0] ?? "",
            keys[0] ? attrs[keys[0]] : "",
            keys[1] ?? "",
            keys[1] ? attrs[keys[1]] : "",
            variant?.sku ?? "",
            variant ? Number(variant.price) : "",
            variant?.stockQuantity ?? "",
            i === 0 ? (product.media[0]?.url ?? "") : "",
          ]);
        }
        for (const media of product.media.slice(1)) {
          rows.push([handle, "", "", "", "", "", "", "", "", "", media.url]);
        }
      }

      const csv = toCsv(PRODUCT_EXPORT_HEADER, rows);
      const key = `stores/${storeId}/exports/products-${Date.now()}.csv`;
      const fileUrl = await this.objectStorage.putObject(key, Buffer.from(csv, "utf-8"), "text/csv");
      await tx.importJob.create({
        data: { storeId, type: "product_export", status: "completed", fileUrl, completedAt: new Date() },
      });
      return fileUrl;
    });
  }

  async exportOrders(sellerId: string, storeId: string): Promise<string> {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const orders = await tx.order.findMany({ where: { storeId }, orderBy: { placedAt: "desc" } });
      const rows = orders.map((o) => [
        o.id,
        o.placedAt.toISOString(),
        o.status,
        o.buyerEmail,
        o.currency,
        Number(o.totalAmount) - Number(o.shippingAmount) - Number(o.taxAmount) + Number(o.discountAmount),
        Number(o.discountAmount),
        Number(o.shippingAmount),
        Number(o.taxAmount),
        Number(o.totalAmount),
      ]);

      const csv = toCsv(ORDER_EXPORT_HEADER, rows);
      const key = `stores/${storeId}/exports/orders-${Date.now()}.csv`;
      const fileUrl = await this.objectStorage.putObject(key, Buffer.from(csv, "utf-8"), "text/csv");
      await tx.importJob.create({
        data: { storeId, type: "order_export", status: "completed", fileUrl, completedAt: new Date() },
      });
      return fileUrl;
    });
  }
}
