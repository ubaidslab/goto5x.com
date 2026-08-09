import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { RedisService } from "../common/redis/redis.service";
import { EmailService } from "../notifications/email.service";
import { InvoicePdfService } from "../invoices/invoice-pdf.service";
import { DRIVE_CLIENT, IDriveClient } from "../media/google-drive/drive-client.interface";
import { DriveConnectionsService } from "../media/google-drive/drive-connections.service";
import { ObjectStorageService } from "../media/object-storage.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { toCsv } from "../data-portability/csv.util";
import { renderExportSummaryHtml } from "./export-summary-template";
import { DATA_EXPORT_JOB_NAME, DATA_EXPORT_QUEUE_NAME } from "./data-export.queue";

const PRODUCT_HEADER = ["Store", "Product ID", "Title", "Status", "Created At"];
const ORDER_HEADER = ["Store", "Order ID", "Placed At", "Status", "Currency", "Total Amount"];
const CUSTOMER_HEADER = ["Store", "Customer ID", "Email", "Name", "Orders Count", "Total Spent", "Created At"];
// Module 28 (SRS §5.39, FR-39.6) - current stock levels, a point-in-time
// snapshot rather than a period-filtered artifact like the three above
// (there is no "stock created within this period" concept).
const INVENTORY_HEADER = ["Store", "Product ID", "Product Title", "Variant ID", "SKU", "Stock Quantity"];

/**
 * Module 24 security fix (v0.28): export bundles contain customer PII, so
 * every object this service writes lives under this prefix, which is never
 * exposed as a public URL anywhere - the sole read path is
 * `downloadFile()`'s ownership-checked stream. Distinct from the
 * `sellers/{id}/...` prefix media/invoices already use, which IS served
 * publicly (documented gap, see docs/SRS.md §14.19's hardening note).
 */
const PRIVATE_EXPORT_PREFIX = "private-exports";

function accessTokenCacheKey(sellerId: string): string {
  return `drive:access_token:${sellerId}`;
}

interface BundleFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  key: string;
}

type DownloadFileParam = "products" | "orders" | "customers" | "inventory" | "summary";

const DOWNLOAD_FILES: Record<
  DownloadFileParam,
  { column: "productsCsvKey" | "ordersCsvKey" | "customersCsvKey" | "inventoryCsvKey" | "summaryPdfKey"; filename: string; contentType: string }
> = {
  products: { column: "productsCsvKey", filename: "products.csv", contentType: "text/csv" },
  orders: { column: "ordersCsvKey", filename: "orders.csv", contentType: "text/csv" },
  customers: { column: "customersCsvKey", filename: "customers.csv", contentType: "text/csv" },
  inventory: { column: "inventoryCsvKey", filename: "inventory.csv", contentType: "text/csv" },
  summary: { column: "summaryPdfKey", filename: "summary.pdf", contentType: "application/pdf" },
};

/**
 * SRS §5.36, FR-36.1-36.5 - the Seller Data Export engine. Reuses the CSV
 * writer (`toCsv`, FR-18.2's own primitive), the Playwright PDF renderer
 * (`InvoicePdfService.generateFromHtml`, FR-19.1), and the Google Drive
 * connection (§3.3) end to end - no new export format, PDF engine, or
 * storage integration. Scoped across ALL of a seller's stores (the trigger
 * - subscription renewal - is per-seller, `Subscription.sellerId` is
 * unique), not any one store.
 */
@Injectable()
export class DataExportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataExportService.name);
  private queue?: Queue;

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly objectStorage: ObjectStorageService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly email: EmailService,
    private readonly driveConnections: DriveConnectionsService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionsService,
    @Inject(DRIVE_CLIENT) private readonly driveClient: IDriveClient,
  ) {}

  onModuleInit() {
    this.queue = new Queue(DATA_EXPORT_QUEUE_NAME, { connection: { url: this.config.getOrThrow<string>("REDIS_URL") } });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  /**
   * FR-36.1(a) - called from PlanFeeDebitService's successful-debit branch.
   * Never throws: a failure here must never block, delay, or affect the
   * subscription renewal itself (FR-36.4) - the same "a seller's legitimate
   * action must never fail because of bookkeeping" discipline as
   * EventsService.emit().
   */
  async triggerRenewalExport(sellerId: string): Promise<void> {
    try {
      await this.enqueue(sellerId, "subscription_renewal");
    } catch (err) {
      this.logger.error(
        `Failed to enqueue renewal data export for seller ${sellerId} - the renewal itself is unaffected.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * FR-36.1(b) - seller-triggered on demand, rate-limited against this same
   * table's most recent row. Module 56 (FR-63.2) - Pro-tier gated, checked
   * before the cooldown below so a sub-Pro seller always gets the upgrade
   * prompt rather than a cooldown message that implies they'd succeed on
   * retry. The subscription-renewal export (triggerRenewalExport() above)
   * is a different trigger entirely and is never gated by this.
   */
  async requestOnDemandExport(sellerId: string) {
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const enabled = await this.settings.resolve<boolean>("data_export.on_demand_enabled", planContext);
    if (!enabled) {
      throw new ForbiddenException("On-demand full export is a Pro-plan feature - upgrade your plan to use it.");
    }

    const minHours = await this.settings.resolve<number>("data_export.on_demand_min_interval_hours");
    const last = await this.prismaAdmin.sellerDataExport.findFirst({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    });
    if (last && Date.now() - last.createdAt.getTime() < minHours * 60 * 60 * 1000) {
      const retryAfterHours = Math.ceil((minHours * 60 * 60 * 1000 - (Date.now() - last.createdAt.getTime())) / (60 * 60 * 1000));
      throw new BadRequestException(
        `You can request a new export every ${minHours} hour(s) - try again in about ${retryAfterHours} hour(s).`,
      );
    }
    return this.enqueue(sellerId, "on_demand");
  }

  /**
   * v0.28 security fix - deliberately excludes the *Key columns from the
   * response shape. Those are internal ObjectStorageService keys, not
   * URLs; returning them to the client would hand back exactly the
   * guessable-path information the download endpoint exists to avoid
   * leaking. `hasX` flags are all the frontend needs to render a
   * download link per file.
   */
  async listOwn(sellerId: string) {
    const rows = await this.prismaAdmin.sellerDataExport.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
      id: r.id,
      trigger: r.trigger,
      status: r.status,
      deliveryMethod: r.deliveryMethod,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      failureReason: r.failureReason,
      hasProductsCsv: r.productsCsvKey !== null,
      hasOrdersCsv: r.ordersCsvKey !== null,
      hasCustomersCsv: r.customersCsvKey !== null,
      hasInventoryCsv: r.inventoryCsvKey !== null,
      hasSummaryPdf: r.summaryPdfKey !== null,
    }));
  }

  /**
   * FR-36.3 (revised, v0.28 security fix) - the only read path for export
   * bytes. Ownership-checked (404, not 403, so a non-owner learns nothing
   * about whether the export exists) and streamed straight from object
   * storage - the raw key is never returned to any client.
   */
  async downloadFile(sellerId: string, exportId: string, file: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const spec = DOWNLOAD_FILES[file as DownloadFileParam];
    if (!spec) {
      throw new BadRequestException(`Unknown export file "${file}".`);
    }

    const record = await this.prismaAdmin.sellerDataExport.findUnique({ where: { id: exportId } });
    if (!record || record.sellerId !== sellerId) {
      throw new NotFoundException("Export not found.");
    }

    const key = record[spec.column];
    if (!key) {
      throw new NotFoundException("This export doesn't have that file.");
    }

    const { body } = await this.objectStorage.getObject(key);
    return { buffer: body, filename: spec.filename, contentType: spec.contentType };
  }

  private async enqueue(sellerId: string, trigger: "subscription_renewal" | "on_demand") {
    const lastCompleted = await this.prismaAdmin.sellerDataExport.findFirst({
      where: { sellerId, status: "completed" },
      orderBy: { periodEnd: "desc" },
    });
    const periodStart = lastCompleted?.periodEnd ?? (await this.prismaAdmin.seller.findUniqueOrThrow({ where: { id: sellerId } })).createdAt;
    const periodEnd = new Date();

    const record = await this.prismaAdmin.sellerDataExport.create({
      data: { sellerId, trigger, periodStart, periodEnd, status: "pending" },
    });
    await this.queue!.add(DATA_EXPORT_JOB_NAME, { exportId: record.id });
    return record;
  }

  /**
   * Called by the Worker. FR-36.4 - never throws; a generation/delivery
   * failure is logged and recorded on the row itself, never propagated.
   */
  async processExport(exportId: string): Promise<void> {
    try {
      const record = await this.prismaAdmin.sellerDataExport.findUniqueOrThrow({ where: { id: exportId } });
      const seller = await this.prismaAdmin.seller.findUniqueOrThrow({
        where: { id: record.sellerId },
        include: { user: true },
      });

      const bundle = await this.generateBundle(seller.id, record.periodStart, record.periodEnd);
      const summaryHtml = renderExportSummaryHtml({
        businessName: seller.businessName,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        productCount: bundle.productCount,
        orderCount: bundle.orderCount,
        customerCount: bundle.customerCount,
        totalRevenue: bundle.totalRevenue,
        currency: bundle.currency,
      });
      const summaryPdfBuffer = await this.invoicePdf.renderToBuffer(summaryHtml);
      const summaryPdfKey = summaryPdfBuffer ? `${PRIVATE_EXPORT_PREFIX}/sellers/${seller.id}/exports/summary-${Date.now()}.pdf` : null;
      if (summaryPdfKey && summaryPdfBuffer) {
        await this.objectStorage.putObject(summaryPdfKey, summaryPdfBuffer, "application/pdf");
      }

      const files: BundleFile[] = [...bundle.files];
      if (summaryPdfKey && summaryPdfBuffer) {
        files.push({ filename: "summary.pdf", mimeType: "application/pdf", buffer: summaryPdfBuffer, key: summaryPdfKey });
      }

      const deliveryMethod = await this.deliver(seller.id, seller.user.email, files);

      await this.prismaAdmin.sellerDataExport.update({
        where: { id: exportId },
        data: {
          status: "completed",
          completedAt: new Date(),
          deliveryMethod,
          productsCsvKey: bundle.productsCsvKey,
          ordersCsvKey: bundle.ordersCsvKey,
          customersCsvKey: bundle.customersCsvKey,
          inventoryCsvKey: bundle.inventoryCsvKey,
          summaryPdfKey,
        },
      });
    } catch (err) {
      this.logger.error(`Data export ${exportId} failed.`, err instanceof Error ? err.stack : String(err));
      await this.prismaAdmin.sellerDataExport
        .update({
          where: { id: exportId },
          data: { status: "failed", failureReason: err instanceof Error ? err.message : "unknown error" },
        })
        .catch(() => {
          // Even the failure-recording write must never throw further - there is nothing else to do here.
        });
    }
  }

  private async generateBundle(sellerId: string, periodStart: Date, periodEnd: Date) {
    const stores = await this.prismaAdmin.store.findMany({ where: { sellerId }, select: { id: true, name: true, currency: true } });
    const storeIds = stores.map((s) => s.id);
    const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
    const currency = stores[0]?.currency ?? "PKR";

    const products = await this.prismaAdmin.product.findMany({
      where: { storeId: { in: storeIds }, createdAt: { gte: periodStart, lte: periodEnd } },
    });
    const productRows = products.map((p) => [storeNameById.get(p.storeId) ?? "", p.id, p.title, p.status, p.createdAt.toISOString()]);
    const productsCsv = toCsv(PRODUCT_HEADER, productRows);

    const orders = await this.prismaAdmin.order.findMany({
      where: { storeId: { in: storeIds }, placedAt: { gte: periodStart, lte: periodEnd } },
    });
    const orderRows = orders.map((o) => [storeNameById.get(o.storeId) ?? "", o.id, o.placedAt.toISOString(), o.status, o.currency, Number(o.totalAmount)]);
    const ordersCsv = toCsv(ORDER_HEADER, orderRows);
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const customers = await this.prismaAdmin.customer.findMany({
      where: { storeId: { in: storeIds }, createdAt: { gte: periodStart, lte: periodEnd } },
    });
    const customerRows = customers.map((c) => [
      storeNameById.get(c.storeId) ?? "",
      c.id,
      c.email,
      c.name ?? "",
      c.ordersCount,
      Number(c.totalSpent),
      c.createdAt.toISOString(),
    ]);
    const customersCsv = toCsv(CUSTOMER_HEADER, customerRows);

    // Module 28 (FR-39.6) - a point-in-time snapshot of every variant's
    // current stock level, not filtered to the period (there's no
    // "created within this period" concept for a live quantity).
    const variants = await this.prismaAdmin.productVariant.findMany({
      where: { storeId: { in: storeIds } },
      include: { product: { select: { title: true } } },
    });
    const inventoryRows = variants.map((v) => [
      storeNameById.get(v.storeId) ?? "",
      v.productId,
      v.product.title,
      v.id,
      v.sku,
      v.stockQuantity,
    ]);
    const inventoryCsv = toCsv(INVENTORY_HEADER, inventoryRows);

    const timestamp = Date.now();
    const productsCsvKey = `${PRIVATE_EXPORT_PREFIX}/sellers/${sellerId}/exports/products-${timestamp}.csv`;
    const ordersCsvKey = `${PRIVATE_EXPORT_PREFIX}/sellers/${sellerId}/exports/orders-${timestamp}.csv`;
    const customersCsvKey = `${PRIVATE_EXPORT_PREFIX}/sellers/${sellerId}/exports/customers-${timestamp}.csv`;
    const inventoryCsvKey = `${PRIVATE_EXPORT_PREFIX}/sellers/${sellerId}/exports/inventory-${timestamp}.csv`;
    await this.objectStorage.putObject(productsCsvKey, Buffer.from(productsCsv, "utf-8"), "text/csv");
    await this.objectStorage.putObject(ordersCsvKey, Buffer.from(ordersCsv, "utf-8"), "text/csv");
    await this.objectStorage.putObject(customersCsvKey, Buffer.from(customersCsv, "utf-8"), "text/csv");
    await this.objectStorage.putObject(inventoryCsvKey, Buffer.from(inventoryCsv, "utf-8"), "text/csv");

    return {
      productsCsvKey,
      ordersCsvKey,
      customersCsvKey,
      inventoryCsvKey,
      productCount: products.length,
      orderCount: orders.length,
      customerCount: customers.length,
      totalRevenue,
      currency,
      files: [
        { filename: "products.csv", mimeType: "text/csv", buffer: Buffer.from(productsCsv, "utf-8"), key: productsCsvKey },
        { filename: "orders.csv", mimeType: "text/csv", buffer: Buffer.from(ordersCsv, "utf-8"), key: ordersCsvKey },
        { filename: "customers.csv", mimeType: "text/csv", buffer: Buffer.from(customersCsv, "utf-8"), key: customersCsvKey },
        { filename: "inventory.csv", mimeType: "text/csv", buffer: Buffer.from(inventoryCsv, "utf-8"), key: inventoryCsvKey },
      ] as BundleFile[],
    };
  }

  /**
   * FR-36.3 (revised, v0.28 security fix) - Drive when the seller has an
   * active, upload-capable connection (unaffected by this fix - that's the
   * seller's own Drive, not this platform's storage); otherwise an email
   * fallback linking to the dashboard's Data export card, never a raw
   * object-storage link, since these files carry customer PII and must
   * require login to reach. A Drive upload failure (network, revoked
   * mid-flight, etc.) falls back to email rather than leaving the export
   * undelivered.
   */
  private async deliver(sellerId: string, email: string, files: BundleFile[]): Promise<"drive" | "email"> {
    const canUpload = await this.driveConnections.canUploadExports(sellerId);
    if (canUpload) {
      try {
        const accessToken = await this.getAccessToken(sellerId);
        const folderId = await this.driveConnections.ensureExportFolderId(sellerId, accessToken);
        for (const file of files) {
          await this.driveClient.uploadFile(accessToken, folderId, file.filename, file.mimeType, file.buffer);
        }
        await this.driveConnections.markUsed(sellerId);
        return "drive";
      } catch (err) {
        this.logger.warn(
          `Drive upload failed for seller ${sellerId}'s data export - falling back to email.`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    const dashboardLink = `${this.config.getOrThrow<string>("APP_BASE_URL")}/login`;
    await this.email.sendDataExportReadyEmail(email, dashboardLink);
    return "email";
  }

  private async getAccessToken(sellerId: string): Promise<string> {
    const cached = await this.redis.get(accessTokenCacheKey(sellerId));
    if (cached) return cached;

    const refreshToken = await this.driveConnections.getDecryptedRefreshToken(sellerId);
    const refreshed = await this.driveClient.refreshAccessToken(refreshToken);
    const ttlSeconds = Math.max(30, refreshed.expiresInSeconds - 60);
    await this.redis.set(accessTokenCacheKey(sellerId), refreshed.accessToken, "EX", ttlSeconds);
    return refreshed.accessToken;
  }
}
