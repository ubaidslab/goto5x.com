import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ProductVariantsService } from "../catalog/product-variants.service";
import { ProductsService } from "../catalog/products.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { parseAdSpendImportCsv } from "./ad-spend-import.util";
import { csvHeader, parseCsv } from "./csv.util";
import { parseProductImportCsv, RowError } from "./product-import.util";
import { parseStockImportCsv } from "./stock-import.util";

/**
 * FR-18.1/18.2 - the worker-invoked half of product CSV import. Runs with no
 * seller session in scope (same reasoning as DomainVerificationService,
 * SupplierSyncService et al.): PrismaAdminService reads the job/store rows,
 * but every actual product/variant write goes through ProductsService/
 * ProductVariantsService so an imported product passes through the exact
 * same moderation/plan-limit gates a manually-created one does - CSV import
 * must never be a way around them.
 */
@Injectable()
export class ProductImportService {
  private readonly logger = new Logger(ProductImportService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly products: ProductsService,
    private readonly variants: ProductVariantsService,
  ) {}

  async process(importJobId: string, createdByUserId?: string): Promise<void> {
    const job = await this.prismaAdmin.importJob.findUniqueOrThrow({ where: { id: importJobId } });
    await this.prismaAdmin.importJob.update({ where: { id: importJobId }, data: { status: "processing" } });

    if (job.type === "stock_import") {
      return this.processStockImport(job, createdByUserId);
    }
    if (job.type === "ad_spend_import") {
      return this.processAdSpendImport(job);
    }

    const rowErrors: RowError[] = [];
    let unmappedFields: string[] = [];

    try {
      const store = await this.prismaAdmin.store.findUniqueOrThrow({
        where: { id: job.storeId },
        select: { sellerId: true },
      });

      const csvText = await (await fetch(job.fileUrl)).text();
      const rows = parseCsv(csvText);
      const header = csvHeader(csvText);
      const parsed = parseProductImportCsv(rows, header);
      unmappedFields = parsed.unmappedFields;
      rowErrors.push(...parsed.rowErrors);

      for (const item of parsed.products) {
        try {
          const product = await this.products.create(store.sellerId, job.storeId, {
            title: item.title,
            description: item.description || undefined,
          });

          for (const variant of item.variants) {
            await this.variants.create(store.sellerId, job.storeId, product.id, {
              sku: variant.sku,
              price: variant.price,
              stockQuantity: variant.stockQuantity,
              attributes: variant.attributes,
            });
          }

          // FR-18.1's "images" core field - the CSV's Image Src is stored
          // as-is (hotlinked), never fetched server-side (see MediaSource's
          // `csv_import` schema comment for why).
          await this.tenantPrisma.run(store.sellerId, async (tx) => {
            for (const url of item.imageUrls) {
              await tx.mediaAsset.create({
                data: { storeId: job.storeId, productId: product.id, url, source: "csv_import", type: "image" },
              });
            }
          });
        } catch (err) {
          rowErrors.push({ row: 0, message: `Product "${item.title}": ${(err as Error).message}` });
        }
      }

      await this.prismaAdmin.importJob.update({
        where: { id: importJobId },
        data: {
          status: "completed",
          unmappedFields,
          errorLog: rowErrors as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Import job ${importJobId} failed: ${(err as Error).message}`);
      await this.prismaAdmin.importJob.update({
        where: { id: importJobId },
        data: {
          status: "failed",
          unmappedFields,
          errorLog: [...rowErrors, { row: 0, message: (err as Error).message }] as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * FR-39.3 - stock-only mode: matches each row's SKU against this store's
   * variants and, for every match, writes the new `stockQuantity` plus an
   * append-only `StockAdjustment` row (FR-39.4's discipline, same as a
   * manual single-row edit) attributed to the uploading user. A SKU that
   * doesn't match any variant is reported as a row error, never silently
   * ignored; an unchanged quantity (new === current) is skipped without an
   * adjustment-log entry, since nothing actually changed.
   */
  private async processStockImport(job: { id: string; storeId: string; fileUrl: string }, createdByUserId?: string): Promise<void> {
    const rowErrors: RowError[] = [];
    let unmappedFields: string[] = [];

    try {
      const store = await this.prismaAdmin.store.findUniqueOrThrow({
        where: { id: job.storeId },
        select: { sellerId: true },
      });
      if (!createdByUserId) throw new Error("Stock import job is missing the uploading user's id.");

      const csvText = await (await fetch(job.fileUrl)).text();
      const rows = parseCsv(csvText);
      const header = csvHeader(csvText);
      const parsed = parseStockImportCsv(rows, header);
      unmappedFields = parsed.unmappedFields;
      rowErrors.push(...parsed.rowErrors);

      await this.tenantPrisma.run(store.sellerId, async (tx) => {
        for (const update of parsed.updates) {
          const variant = await tx.productVariant.findFirst({ where: { storeId: job.storeId, sku: update.sku } });
          if (!variant) {
            rowErrors.push({ row: update.row, message: `No variant with SKU "${update.sku}" in this store - skipped.` });
            continue;
          }
          if (variant.stockQuantity === update.quantity) continue;

          await tx.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: update.quantity } });
          await tx.stockAdjustment.create({
            data: {
              storeId: job.storeId,
              productVariantId: variant.id,
              adjustedByUserId: createdByUserId,
              quantityBefore: variant.stockQuantity,
              quantityAfter: update.quantity,
              reason: `Bulk CSV import (job ${job.id})`,
            },
          });
        }
      });

      await this.prismaAdmin.importJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          unmappedFields,
          errorLog: rowErrors as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Stock import job ${job.id} failed: ${(err as Error).message}`);
      await this.prismaAdmin.importJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          unmappedFields,
          errorLog: [...rowErrors, { row: 0, message: (err as Error).message }] as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Module 31 (SRS §5.42/FR-42.1) - creates one AdSpendEntry per valid row,
   * `source: "csv_import"` (FR-42.6's documented extension seam). A
   * malformed row is reported and skipped, never fails the whole import.
   */
  private async processAdSpendImport(job: { id: string; storeId: string; fileUrl: string }): Promise<void> {
    const rowErrors: RowError[] = [];
    let unmappedFields: string[] = [];

    try {
      const store = await this.prismaAdmin.store.findUniqueOrThrow({
        where: { id: job.storeId },
        select: { sellerId: true },
      });

      const csvText = await (await fetch(job.fileUrl)).text();
      const rows = parseCsv(csvText);
      const header = csvHeader(csvText);
      const parsed = parseAdSpendImportCsv(rows, header);
      unmappedFields = parsed.unmappedFields;
      rowErrors.push(...parsed.rowErrors);

      await this.tenantPrisma.run(store.sellerId, async (tx) => {
        for (const entry of parsed.entries) {
          await tx.adSpendEntry.create({
            data: {
              storeId: job.storeId,
              periodStart: new Date(entry.periodStart),
              periodEnd: new Date(entry.periodEnd),
              amount: entry.amount,
              source: "csv_import",
              note: entry.note ?? null,
            },
          });
        }
      });

      await this.prismaAdmin.importJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          unmappedFields,
          errorLog: rowErrors as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Ad-spend import job ${job.id} failed: ${(err as Error).message}`);
      await this.prismaAdmin.importJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          unmappedFields,
          errorLog: [...rowErrors, { row: 0, message: (err as Error).message }] as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    }
  }
}
