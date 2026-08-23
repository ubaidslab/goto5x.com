import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { RedisService } from "../common/redis/redis.service";
import { ObjectStorageService } from "../media/object-storage.service";
import { INVOICE_GENERATION_QUEUE_NAME } from "../billing/invoice-generation.queue";
import { INVOICE_OVERDUE_QUEUE_NAME } from "../billing/invoice-overdue.queue";
import { PLAN_FEE_DEBIT_QUEUE_NAME } from "../billing/plan-fee-debit.queue";
import { WALLET_LOW_BALANCE_SWEEP_QUEUE_NAME } from "../billing/wallet-low-balance-sweep.queue";
import { WALLET_RECONCILIATION_QUEUE_NAME } from "../billing/wallet-reconciliation.queue";
import { DATA_EXPORT_QUEUE_NAME } from "../data-export/data-export.queue";
import { PRODUCT_IMPORT_QUEUE_NAME } from "../data-portability/product-import.queue";
import { DOMAIN_VERIFICATION_QUEUE_NAME } from "../domains/domain-verification.queue";
import { DORMANT_STORE_QUEUE_NAME } from "../guardrails/dormant-store.queue";
import { CART_ABANDONMENT_QUEUE_NAME } from "../orders/cart-abandonment.queue";
import { STORE_HEALTH_SWEEP_QUEUE_NAME } from "../store-health/store-health-sweep.queue";
import { SUPPLIER_SYNC_QUEUE_NAME } from "../suppliers/supplier-sync.queue";
import { VERIFICATION_RE_REVIEW_SWEEP_QUEUE_NAME } from "../verification/verification-re-review-sweep.queue";
import { GatewayHealthService } from "../payment-gateway/gateway-health.service";

const QUEUE_NAMES = [
  INVOICE_GENERATION_QUEUE_NAME,
  INVOICE_OVERDUE_QUEUE_NAME,
  PLAN_FEE_DEBIT_QUEUE_NAME,
  WALLET_LOW_BALANCE_SWEEP_QUEUE_NAME,
  WALLET_RECONCILIATION_QUEUE_NAME,
  DATA_EXPORT_QUEUE_NAME,
  PRODUCT_IMPORT_QUEUE_NAME,
  DOMAIN_VERIFICATION_QUEUE_NAME,
  DORMANT_STORE_QUEUE_NAME,
  CART_ABANDONMENT_QUEUE_NAME,
  STORE_HEALTH_SWEEP_QUEUE_NAME,
  SUPPLIER_SYNC_QUEUE_NAME,
  VERIFICATION_RE_REVIEW_SWEEP_QUEUE_NAME,
];

/**
 * Module 25 P1 - the system status page's data source (SRS §14, item 3 of
 * the founder's Module 25 commission: "system status page... a stub line
 * 'backups: not yet configured' is fine until [OPS hardening] lands").
 * Genuinely new instrumentation - nothing before this module exposed
 * queue depths, storage reachability, or a backups/email status line in
 * one place. Read-only: opens its own BullMQ `Queue` clients purely to
 * call `getJobCounts()` (same constructor pattern every scheduler already
 * uses), never a worker and never mutates a job.
 *
 * Email delivery failures are NOT tracked below - disclosed, not silently
 * omitted: `EmailService` (notifications/email.service.ts) only has a
 * console-log fallback in this environment (`EMAIL_PROVIDER=console`) and
 * throws for any other configured provider - there is no real send path
 * yet whose failures could be recorded. This is reported as a stub line,
 * the same discipline the founder authorized for the backups line.
 */
@Injectable()
export class AdminSystemStatusService implements OnModuleInit, OnModuleDestroy {
  private queues: Queue[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaRuntimeService,
    private readonly redis: RedisService,
    private readonly objectStorage: ObjectStorageService,
    private readonly gatewayHealth: GatewayHealthService,
  ) {}

  onModuleInit() {
    const connection = { url: this.config.getOrThrow<string>("REDIS_URL") };
    this.queues = QUEUE_NAMES.map((name) => new Queue(name, { connection }));
  }

  async onModuleDestroy() {
    await Promise.all(this.queues.map((q) => q.close()));
  }

  async getStatus() {
    const [dbOk, redisOk, storageOk, queueStatuses, gatewayHealthRollup] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.objectStorage.checkReachable(),
      Promise.all(
        this.queues.map(async (q) => {
          const counts = await q.getJobCounts("waiting", "active", "delayed", "failed");
          return { name: q.name, ...counts };
        }),
      ),
      this.gatewayHealth.getProviderRollup(),
    ]);

    return {
      db: dbOk,
      redis: redisOk,
      objectStorage: storageOk,
      queues: queueStatuses,
      email: {
        provider: this.config.get<string>("EMAIL_PROVIDER", "console"),
        deliveryFailures: "not tracked - no real email provider integrated yet (console-only in this environment)",
      },
      backups: "not yet configured",
      // Module 67 (SRS §5.6k, FR-6.44) - per-provider rollup aggregated
      // across every seller's connection to that provider.
      paymentGatewayHealth: gatewayHealthRollup,
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
