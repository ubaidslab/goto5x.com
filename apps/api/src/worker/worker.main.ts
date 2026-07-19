import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { AppModule } from "../app.module";
import { InvoicesService } from "../billing/invoices.service";
import { INVOICE_GENERATION_QUEUE_NAME } from "../billing/invoice-generation.queue";
import { INVOICE_OVERDUE_QUEUE_NAME } from "../billing/invoice-overdue.queue";
import { ProductImportService } from "../data-portability/product-import.service";
import { PRODUCT_IMPORT_QUEUE_NAME } from "../data-portability/product-import.queue";
import { DomainVerificationService } from "../domains/domain-verification.service";
import { DOMAIN_VERIFICATION_QUEUE_NAME } from "../domains/domain-verification.queue";
import { DormantStoreService } from "../guardrails/dormant-store.service";
import { DORMANT_STORE_QUEUE_NAME } from "../guardrails/dormant-store.queue";
import { CartService } from "../orders/cart.service";
import { CART_ABANDONMENT_QUEUE_NAME } from "../orders/cart-abandonment.queue";
import { SupplierSyncService } from "../suppliers/supplier-sync.service";
import { SUPPLIER_SYNC_QUEUE_NAME } from "../suppliers/supplier-sync.queue";

/**
 * Module 3 gives this worker its first real job (Module 1's comment said
 * "later modules register BullMQ Worker instances here" - this is that
 * module). Bootstraps the full NestJS DI container (no HTTP listener) so
 * the job processor can resolve real application services exactly like a
 * request handler would, rather than duplicating their construction here.
 */
async function main() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const config = appContext.get(ConfigService);
  const domainVerification = appContext.get(DomainVerificationService);
  const supplierSync = appContext.get(SupplierSyncService);
  const cart = appContext.get(CartService);
  const invoices = appContext.get(InvoicesService);
  const dormantStores = appContext.get(DormantStoreService);
  const productImport = appContext.get(ProductImportService);

  const domainWorker = new Worker(
    DOMAIN_VERIFICATION_QUEUE_NAME,
    async () => {
      const result = await domainVerification.recheckOutstandingDomains();
      if (result.failures.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`domain-verification: ${result.failures.length}/${result.checked} rechecks failed`, result.failures);
      }
      return result;
    },
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  domainWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`domain-verification job ${job?.id} failed:`, err);
  });

  // Module 8 (FR-4.3) - price/stock sync. SupplierSyncService itself never
  // throws for the whole batch (per-supplier failures are caught and
  // logged inside it), so this processor has nothing extra to catch.
  const supplierSyncWorker = new Worker(
    SUPPLIER_SYNC_QUEUE_NAME,
    async () => supplierSync.syncAllEnabledAdapters(),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  supplierSyncWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`supplier-sync job ${job?.id} failed:`, err);
  });

  // Module 9 (FR-15.2) - flags captured-email carts inactive beyond the
  // configured window; CartService itself never throws for the whole
  // batch (a single bad row can't block the sweep).
  const cartAbandonmentWorker = new Worker(
    CART_ABANDONMENT_QUEUE_NAME,
    async () => cart.flagAbandonedCarts(),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  cartAbandonmentWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`cart-abandonment job ${job?.id} failed:`, err);
  });

  // Module 11 (FR-6.17) - idempotent (checks for an already-generated
  // invoice per seller/period before creating one), so running this more
  // often than strictly monthly is safe. Module 14 (FR-7.15/7.18) - the
  // same job also generates each team's monthly group-sponsorship invoice,
  // an equally idempotent, equally monthly job; no reason for a second
  // scheduler/queue.
  const invoiceGenerationWorker = new Worker(
    INVOICE_GENERATION_QUEUE_NAME,
    async () => {
      await invoices.generateMonthlyInvoices();
      await invoices.generateMonthlyGroupInvoices();
    },
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  invoiceGenerationWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`invoice-generation job ${job?.id} failed:`, err);
  });

  // Module 11 (FR-6.18) - grace-period-overdue sweep.
  const invoiceOverdueWorker = new Worker(
    INVOICE_OVERDUE_QUEUE_NAME,
    async () => invoices.sweepOverdueInvoicesAndSuspend(),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  invoiceOverdueWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`invoice-overdue-sweep job ${job?.id} failed:`, err);
  });

  // Module 14 (FR-23.2) - dormant-store lifecycle sweep.
  const dormantStoreWorker = new Worker(
    DORMANT_STORE_QUEUE_NAME,
    async () => dormantStores.runSweep(),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  dormantStoreWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`dormant-store-sweep job ${job?.id} failed:`, err);
  });

  // Module 15 (FR-18.1/18.2) - per-upload job, unlike the sweeps above.
  // ProductImportService itself never throws for a single bad row (a
  // per-row error is logged onto the job's own error_log instead); this
  // processor only needs to catch a whole-job failure (unparseable CSV,
  // storage/DB outage).
  const productImportWorker = new Worker(
    PRODUCT_IMPORT_QUEUE_NAME,
    async (job) => productImport.process(job.data.importJobId as string),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  productImportWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`product-import job ${job?.id} failed:`, err);
  });

  // eslint-disable-next-line no-console
  console.log(
    "goto5x worker started (domain-verification - Module 3; supplier-sync - Module 8; cart-abandonment - Module 9; invoice-generation/invoice-overdue-sweep - Module 11; dormant-store-sweep - Module 14; product-import - Module 15).",
  );

  const shutdown = async () => {
    await domainWorker.close();
    await supplierSyncWorker.close();
    await cartAbandonmentWorker.close();
    await invoiceGenerationWorker.close();
    await invoiceOverdueWorker.close();
    await dormantStoreWorker.close();
    await productImportWorker.close();
    await appContext.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
