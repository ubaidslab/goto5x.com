import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ImportJobType } from "@prisma/client";
import { Queue } from "bullmq";
import { ObjectStorageService } from "../media/object-storage.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { PRODUCT_IMPORT_QUEUE_NAME } from "./product-import.queue";

/**
 * FR-18.1/18.2 - creates the tracked job row and, for an import, enqueues
 * the actual processing onto BullMQ so the upload request itself returns
 * immediately (never a synchronous, dashboard-blocking request).
 */
@Injectable()
export class ImportJobsService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly objectStorage: ObjectStorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.queue = new Queue(PRODUCT_IMPORT_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  /** FR-18.1 - the seller's uploaded CSV, persisted before processing starts. */
  async createImportJob(sellerId: string, storeId: string, file: { buffer: Buffer; originalname: string }) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const key = `stores/${storeId}/imports/${Date.now()}-${file.originalname}`;
      const fileUrl = await this.objectStorage.putObject(key, file.buffer, "text/csv");

      const job = await tx.importJob.create({
        data: { storeId, type: "product_import", status: "pending", fileUrl },
      });

      await this.queue!.add("process", { importJobId: job.id });
      return job;
    });
  }

  /**
   * FR-39.3 - reuses this exact job/queue/error-report machinery in a
   * narrower "SKU + new quantity only" mode. `userId` travels through the
   * job payload (not the `ImportJob` row - it has no creator-user column)
   * so the background worker can attribute the resulting `StockAdjustment`
   * rows to the seller-account user who uploaded the CSV, same as a manual
   * single-row adjustment.
   */
  async createStockImportJob(sellerId: string, storeId: string, userId: string, file: { buffer: Buffer; originalname: string }) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const key = `stores/${storeId}/imports/stock-${Date.now()}-${file.originalname}`;
      const fileUrl = await this.objectStorage.putObject(key, file.buffer, "text/csv");

      const job = await tx.importJob.create({
        data: { storeId, type: "stock_import", status: "pending", fileUrl },
      });

      await this.queue!.add("process", { importJobId: job.id, createdByUserId: userId });
      return job;
    });
  }

  async list(sellerId: string, storeId: string, type?: ImportJobType) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.importJob.findMany({
        where: { storeId, ...(type ? { type } : {}) },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async getOne(sellerId: string, storeId: string, jobId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const job = await tx.importJob.findUnique({ where: { id: jobId } });
      if (!job || job.storeId !== storeId) throw new NotFoundException("Import job not found.");
      return job;
    });
  }
}
