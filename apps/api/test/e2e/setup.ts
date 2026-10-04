import { ValidationPipe, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { LedgerEntryType, PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { AppModule } from "../../src/app.module";
import { signedContribution } from "../../src/billing/wallet.service";
import { seedDefaults } from "../../src/bootstrap/seed-defaults";

/**
 * Builds a real NestJS app wired to the real local Postgres/Redis started for
 * this test run (see README "Running tests") - no mocking of the database or
 * cache, since the whole point of Module 1's test list is proving the RLS/
 * settings-registry/audit-log mechanisms against a real Postgres instance.
 */
export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

/**
 * Test cleanup needs to TRUNCATE `admin_audit_logs`/`user_security_events`,
 * which even app_admin cannot do - those two tables intentionally revoke
 * UPDATE/DELETE from every application role for immutability (SRS FR-8.9),
 * and TRUNCATE isn't granted to either role either. Only the Postgres
 * superuser can reset them, so test setup/teardown uses that connection
 * string directly - a test-only concern, not a production code path, and
 * never the connection string the running application itself uses.
 */
export function superuserPrismaForTests(): PrismaClient {
  const url = process.env.TEST_SUPERUSER_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_SUPERUSER_DATABASE_URL must be set to run e2e tests (see README).");
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      admin_audit_logs, platform_events, settings_values, settings_definitions,
      domains, store_theme_settings,
      seller_api_tokens, template_entitlements, external_api_clients, themes,
      platform_gateway_connections, platform_gateway_consumed_references, platform_gateway_flagged_verifications,
      collection_products, collections, store_navigation_menus,
      store_shipping_settings, store_tax_settings, store_payment_instructions, discount_codes,
      gift_card_redemptions, gift_cards, email_campaigns, customer_segments,
      listing_reviews, supplier_listings, store_supplier_links, supplier_adapters,
      ledger_entries, seller_invoices, wallet_topup_requests, supplier_wallet_entries,
      payments, tracking_updates, order_timeline_events, order_notes, order_items, orders, carts,
      review_media, product_reviews, customers, import_jobs,
      media_assets, product_variants, products, categories,
      google_drive_connections,
      seller_agreement_versions,
      platform_promo_code_redemptions, platform_promo_codes,
      team_members, teams,
      job_applications, job_postings,
      verified_store_applications, store_health_score_history,
      seller_data_exports,
      payout_requests, program_content_submissions, referral_attributions, program_participants,
      subscriptions,
      staff_accounts, admin_email_accounts,
      stores, admin_users, sellers, suppliers, user_security_events, users, plans,
      seller_signup_waitlist,
      impersonation_sessions, content_page_revisions, content_pages,
      platform_brand_asset_revisions, platform_brand_assets, platform_messages,
      database_backup_runs
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Thin re-export, kept under its original name for the ~100 e2e spec files
 * that already call `seedSettings(superuser)` - the real body now lives in
 * `src/bootstrap/seed-defaults.ts` as `seedDefaults()`, which is also the
 * function `main.ts` calls on every real API boot (see that file's own
 * comment for the production bug this consolidation fixes).
 */
export async function seedSettings(prisma: PrismaClient): Promise<void> {
  await seedDefaults(prisma);
}

/**
 * The Settings Registry cache and the auth rate limiter both live in Redis,
 * which is a single shared server across the whole test run (not reset per
 * Postgres TRUNCATE). Without this, a rate-limit override or a cached
 * setting value from one test leaks into the next test/file and produces
 * confusing, order-dependent failures - caught by running the full e2e
 * suite repeatedly and seeing results change based on run order/timing,
 * which is exactly the smell of shared mutable state leaking across tests.
 */
export async function resetRedis(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.flushall();
  await redis.quit();
}

/**
 * Module 47 - a test-only LedgerEntry seeder that ALSO updates the
 * WalletBalance cache, mirroring WalletService.postLedgerEntry() exactly
 * (same signedContribution() sign mapping, imported directly rather than
 * re-implemented, so the two can never drift apart). Several existing e2e
 * specs seed scenario state by writing a LedgerEntry directly via the
 * superuser Prisma client rather than going through the real top-up/
 * checkout/etc. HTTP flow - a legitimate test shortcut, but one that would
 * silently leave WalletBalance at 0 (and getBalance() reading that stale
 * cache) if it used `prisma.ledgerEntry.create()` directly post-Module-47.
 * Use this instead wherever a test needs to seed a ledger row directly.
 */
export async function seedLedgerEntry(
  prisma: PrismaClient,
  data: { sellerId: string; type: LedgerEntryType; amount: number; currency: string; orderId?: string; invoiceId?: string },
): Promise<void> {
  await prisma.ledgerEntry.create({ data });
  const delta = signedContribution(data.type, data.amount);
  await prisma.walletBalance.upsert({
    where: { sellerId: data.sellerId },
    create: { sellerId: data.sellerId, balance: delta },
    update: { balance: { increment: delta } },
  });
}

/**
 * SRS §5.70/FR-70.5 - UnitEconomicsService.computeRealTimeAnalytics()/
 * AdminOverviewService.getOverview() now group GMV/revenue by currency
 * instead of returning one blended number. Every store these e2e specs
 * create defaults to PKR (none of them pass a currency), so tests only
 * ever need the PKR line out of the breakdown.
 */
export function pkrAmount(breakdown: { currency: string; amount: number }[]): number {
  return breakdown.find((row) => row.currency === "PKR")?.amount ?? 0;
}
