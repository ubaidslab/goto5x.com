import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { AppModule } from "../app.module";
import { DomainVerificationService } from "../domains/domain-verification.service";
import { DOMAIN_VERIFICATION_QUEUE_NAME } from "../domains/domain-verification.queue";
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

  // eslint-disable-next-line no-console
  console.log(
    "goto5x worker started (domain-verification - Module 3; supplier-sync - Module 8; cart-abandonment - Module 9).",
  );

  const shutdown = async () => {
    await domainWorker.close();
    await supplierSyncWorker.close();
    await cartAbandonmentWorker.close();
    await appContext.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
