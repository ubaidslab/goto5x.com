import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { AppModule } from "../app.module";
import { DomainVerificationService } from "../domains/domain-verification.service";
import { DOMAIN_VERIFICATION_QUEUE_NAME } from "../domains/domain-verification.queue";

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

  const worker = new Worker(
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

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`domain-verification job ${job?.id} failed:`, err);
  });

  // eslint-disable-next-line no-console
  console.log("goto5x worker started (domain-verification processor registered - Module 3).");

  const shutdown = async () => {
    await worker.close();
    await appContext.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
