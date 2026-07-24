import { BadRequestException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { RedisService } from "../common/redis/redis.service";
import { EmailService } from "../notifications/email.service";
import { InvoicePdfService } from "../invoices/invoice-pdf.service";
import { DRIVE_CLIENT, IDriveClient } from "../media/google-drive/drive-client.interface";
import { DriveConnectionsService } from "../media/google-drive/drive-connections.service";
import { ObjectStorageService } from "../media/object-storage.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { toCsv } from "../data-portability/csv.util";
import { renderExportSummaryHtml } from "./export-summary-template";
import { DATA_EXPORT_JOB_NAME, DATA_EXPORT_QUEUE_NAME } from "./data-export.queue";

const PRODUCT_HEADER = ["Store", "Product ID", "Title", "Status", "Created At"];
const ORDER_HEADER = ["Store", "Order ID", "Placed At", "Status", "Currency", "Total Amount"];
const CUSTOMER_HEADER = ["Store", "Customer ID", "Email", "Name", "Orders Count", "Total Spent", "Created At"];

function accessTokenCacheKey(sellerId: string): string {
  return `drive:access_token:${sellerId}`;
}

interface BundleFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  url: string;
}

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

  /** FR-36.1(b) - seller-triggered on demand, rate-limited against this same table's most recent row. */
  async requestOnDemandExport(sellerId: string) {
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

  async listOwn(sellerId: string) {
    return this.prismaAdmin.sellerDataExport.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } });
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
      const summaryPdfUrl = summaryPdfBuffer
        ? await this.objectStorage.putObject(`sellers/${seller.id}/exports/summary-${Date.now()}.pdf`, summaryPdfBuffer, "application/pdf")
        : null;

      const files: BundleFile[] = [...bundle.files];
      if (summaryPdfUrl && summaryPdfBuffer) {
        files.push({ filename: "summary.pdf", mimeType: "application/pdf", buffer: summaryPdfBuffer, url: summaryPdfUrl });
      }

      const deliveryMethod = await this.deliver(seller.id, seller.user.email, files);

      await this.prismaAdmin.sellerDataExport.update({
        where: { id: exportId },
        data: {
          status: "completed",
          completedAt: new Date(),
          deliveryMethod,
          productsCsvUrl: bundle.productsCsvUrl,
          ordersCsvUrl: bundle.ordersCsvUrl,
          customersCsvUrl: bundle.customersCsvUrl,
          summaryPdfUrl,
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

    const timestamp = Date.now();
    const productsCsvUrl = await this.objectStorage.putObject(
      `sellers/${sellerId}/exports/products-${timestamp}.csv`,
      Buffer.from(productsCsv, "utf-8"),
      "text/csv",
    );
    const ordersCsvUrl = await this.objectStorage.putObject(
      `sellers/${sellerId}/exports/orders-${timestamp}.csv`,
      Buffer.from(ordersCsv, "utf-8"),
      "text/csv",
    );
    const customersCsvUrl = await this.objectStorage.putObject(
      `sellers/${sellerId}/exports/customers-${timestamp}.csv`,
      Buffer.from(customersCsv, "utf-8"),
      "text/csv",
    );

    return {
      productsCsvUrl,
      ordersCsvUrl,
      customersCsvUrl,
      productCount: products.length,
      orderCount: orders.length,
      customerCount: customers.length,
      totalRevenue,
      currency,
      files: [
        { filename: "products.csv", mimeType: "text/csv", buffer: Buffer.from(productsCsv, "utf-8"), url: productsCsvUrl },
        { filename: "orders.csv", mimeType: "text/csv", buffer: Buffer.from(ordersCsv, "utf-8"), url: ordersCsvUrl },
        { filename: "customers.csv", mimeType: "text/csv", buffer: Buffer.from(customersCsv, "utf-8"), url: customersCsvUrl },
      ] as BundleFile[],
    };
  }

  /**
   * FR-36.3 - Drive when the seller has an active, upload-capable
   * connection; otherwise the email-with-download-link fallback. A Drive
   * upload failure (network, revoked mid-flight, etc.) falls back to email
   * rather than leaving the export undelivered.
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

    const primaryLink = files.find((f) => f.filename === "summary.pdf")?.url ?? files[0]?.url ?? "";
    await this.email.sendDataExportReadyEmail(email, primaryLink);
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
