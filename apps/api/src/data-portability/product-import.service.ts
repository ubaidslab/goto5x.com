import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ProductVariantsService } from "../catalog/product-variants.service";
import { ProductsService } from "../catalog/products.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { csvHeader, parseCsv } from "./csv.util";
import { parseProductImportCsv, RowError } from "./product-import.util";

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

  async process(importJobId: string): Promise<void> {
    const job = await this.prismaAdmin.importJob.findUniqueOrThrow({ where: { id: importJobId } });
    await this.prismaAdmin.importJob.update({ where: { id: importJobId }, data: { status: "processing" } });

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
}
