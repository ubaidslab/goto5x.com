import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { AppModule } from "../app.module";
import { WalletGraceLadderService } from "../billing/wallet-grace-ladder.service";
import { WALLET_LOW_BALANCE_SWEEP_QUEUE_NAME } from "../billing/wallet-low-balance-sweep.queue";
import { PlanFeeDebitService } from "../billing/plan-fee-debit.service";
import { PLAN_FEE_DEBIT_QUEUE_NAME } from "../billing/plan-fee-debit.queue";
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
import { StoreHealthScoreService } from "../store-health/store-health-score.service";
import { STORE_HEALTH_SWEEP_QUEUE_NAME } from "../store-health/store-health-sweep.queue";
import { VerificationReReviewService } from "../verification/verification-re-review.service";
import { VERIFICATION_RE_REVIEW_SWEEP_QUEUE_NAME } from "../verification/verification-re-review-sweep.queue";
import { DataExportService } from "../data-export/data-export.service";
import { DATA_EXPORT_JOB_NAME, DATA_EXPORT_QUEUE_NAME } from "../data-export/data-export.queue";
import { EmailCampaignsService } from "../campaigns/email-campaigns.service";
import { EMAIL_CAMPAIGNS_QUEUE_NAME } from "../campaigns/campaigns.queue";

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
  const walletGraceLadder = appContext.get(WalletGraceLadderService);
  const planFeeDebit = appContext.get(PlanFeeDebitService);
  const dormantStores = appContext.get(DormantStoreService);
  const productImport = appContext.get(ProductImportService);
  const storeHealth = appContext.get(StoreHealthScoreService);
  const verificationReReview = appContext.get(VerificationReReviewService);
  const dataExport = appContext.get(DataExportService);
  const emailCampaigns = appContext.get(EmailCampaignsService);

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

  // Module 20 (SRS §5.6e, FR-6.24, revised FR-7.2) - replaces Module 11's
  // invoice-generation job (FR-6.28: that job's code is unchanged and
  // still callable, just no longer scheduled/consumed here). Debits plan
  // fees, Team seat totals, and device-slot add-ons from the seller
  // wallet instead of generating an invoice.
  const planFeeDebitWorker = new Worker(
    PLAN_FEE_DEBIT_QUEUE_NAME,
    async () => {
      const result = await planFeeDebit.runMonthlyDebitSweep();
      // Module 24 (SRS §5.36, FR-36.1(a)) - triggered at this orchestration
      // layer, not via a direct service injection into PlanFeeDebitService,
      // which would create a real module cycle (BillingModule ->
      // DataExportModule -> MediaModule -> AuthModule -> GrowthProgramsModule
      // -> BillingModule). triggerRenewalExport() never throws.
      for (const sellerId of result.renewedSellerIds) {
        await dataExport.triggerRenewalExport(sellerId);
      }
      return result;
    },
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  planFeeDebitWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`plan-fee-debit job ${job?.id} failed:`, err);
  });

  // Module 20 (FR-6.25) - replaces Module 11's overdue-invoice-suspend
  // sweep for the commission side of the wallet: warning -> grace days ->
  // orders_paused, with instant restore handled separately at top-up
  // verification time (AdminWalletController).
  const walletLowBalanceSweepWorker = new Worker(
    WALLET_LOW_BALANCE_SWEEP_QUEUE_NAME,
    async () => walletGraceLadder.runSweep(),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  walletLowBalanceSweepWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`wallet-low-balance-sweep job ${job?.id} failed:`, err);
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
    async (job) => productImport.process(job.data.importJobId as string, job.data.createdByUserId as string | undefined),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  productImportWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`product-import job ${job?.id} failed:`, err);
  });

  // Module 23 (SRS §5.34, FR-34.2) - Store Health Score recompute sweep.
  const storeHealthSweepWorker = new Worker(
    STORE_HEALTH_SWEEP_QUEUE_NAME,
    async () => storeHealth.runSweep(),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  storeHealthSweepWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`store-health-sweep job ${job?.id} failed:`, err);
  });

  // Module 23 (SRS §5.35, FR-35.5/35.6) - Verified Store re-review/expiry sweep.
  const verificationReReviewSweepWorker = new Worker(
    VERIFICATION_RE_REVIEW_SWEEP_QUEUE_NAME,
    async () => verificationReReview.runSweep(),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  verificationReReviewSweepWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`verification-re-review-sweep job ${job?.id} failed:`, err);
  });

  // Module 24 (SRS §5.36, FR-36.1-36.4) - per-export processing job.
  // DataExportService.processExport() never throws (FR-36.4) - a
  // generation/delivery failure is caught inside it and recorded on the
  // export row itself.
  const dataExportWorker = new Worker(
    DATA_EXPORT_QUEUE_NAME,
    async (job) => dataExport.processExport(job.data.exportId as string),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  dataExportWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`${DATA_EXPORT_JOB_NAME} (seller-data-export) job ${job?.id} failed:`, err);
  });

  // Module 34 (SRS §5.51, FR-51.6) - per-campaign send job.
  // EmailCampaignsService.processCampaign() never throws (a send/decrypt
  // failure is caught inside it and recorded on the campaign row itself),
  // same discipline as Module 24's export processor above.
  const emailCampaignsWorker = new Worker(
    EMAIL_CAMPAIGNS_QUEUE_NAME,
    async (job) => emailCampaigns.processCampaign(job.data.campaignId as string),
    { connection: { url: config.getOrThrow<string>("REDIS_URL") } },
  );

  emailCampaignsWorker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`email-campaigns job ${job?.id} failed:`, err);
  });

  // eslint-disable-next-line no-console
  console.log(
    "UZEYN worker started (domain-verification - Module 3; supplier-sync - Module 8; cart-abandonment - Module 9; dormant-store-sweep - Module 14; product-import - Module 15; plan-fee-debit/wallet-low-balance-sweep - Module 20, replacing Module 11's now-unscheduled invoice-generation/invoice-overdue-sweep; store-health-sweep/verification-re-review-sweep - Module 23; seller-data-export - Module 24; email-campaigns - Module 34).",
  );

  const shutdown = async () => {
    await domainWorker.close();
    await supplierSyncWorker.close();
    await cartAbandonmentWorker.close();
    await planFeeDebitWorker.close();
    await walletLowBalanceSweepWorker.close();
    await dormantStoreWorker.close();
    await productImportWorker.close();
    await storeHealthSweepWorker.close();
    await verificationReReviewSweepWorker.close();
    await dataExportWorker.close();
    await emailCampaignsWorker.close();
    await appContext.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
