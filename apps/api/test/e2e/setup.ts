import { ValidationPipe, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { AppModule } from "../../src/app.module";
import { seedAccountSecuritySettings } from "../../src/auth/account-security.seed";
import { seedCampaignsSettings } from "../../src/campaigns/campaigns.seed";
import { seedCareersSettings } from "../../src/careers/careers.seed";
import { seedDataExportSettings } from "../../src/data-export/data-export.seed";
import { seedOnboardingSettings } from "../../src/auth/onboarding.seed";
import { seedBillingSettings } from "../../src/billing/billing.seed";
import { seedWalletSettings } from "../../src/billing/wallet.seed";
import { seedModerationSettings } from "../../src/moderation/moderation.seed";
import { seedExternalApiSettings } from "../../src/external-api/external-api.seed";
import { seedGrowthProgramsSettings } from "../../src/growth-programs/growth-programs.seed";
import { seedImpersonationSettings } from "../../src/impersonation/impersonation.seed";
import { seedInventorySettings } from "../../src/inventory/inventory.seed";
import { seedWhatsAppMessagingSettings } from "../../src/whatsapp-messaging/whatsapp-messaging.seed";
import { seedMessagingSettings } from "../../src/messaging/messaging.seed";
import { seedOrdersSettings } from "../../src/orders/orders.seed";
import { seedOrderVerificationSettings } from "../../src/orders/order-verification.seed";
import { seedPlansData, seedPlansSettings } from "../../src/plans/plans.seed";
import {
  seedModule1Settings,
  seedModule3Settings,
  seedPlatformEventsSettings,
} from "../../src/settings-registry/settings.seed";
import { seedStaffSettings } from "../../src/staff/staff.seed";
import { seedStoreHealthSettings } from "../../src/store-health/store-health.seed";
import { seedSupplierSettings } from "../../src/suppliers/suppliers.seed";
import { seedBuiltInThemes, seedModule4Settings, seedTemplatesBrandingSettings } from "../../src/theme-engine/themes.seed";
import { seedSellerAgreementV1, seedTrustSafetySettings } from "../../src/trust-safety/trust-safety.seed";
import { seedVerificationSettings } from "../../src/verification/verification.seed";

/**
 * Builds a real NestJS app wired to the real local Postgres/Redis started for
 * this test run (see README "Running tests") - no mocking of the database or
 * cache, since the whole point of Module 1's test list is proving the RLS/
 * settings-registry/audit-log mechanisms against a real Postgres instance.
 */
export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
      collection_products, collections, store_navigation_menus,
      store_shipping_settings, store_tax_settings, store_payment_instructions, discount_codes,
      gift_card_redemptions, gift_cards, email_campaigns, customer_segments,
      listing_reviews, supplier_listings, store_supplier_links, supplier_adapters,
      ledger_entries, seller_invoices, wallet_topup_requests, supplier_wallet_entries,
      payments, tracking_updates, order_timeline_events, order_notes, order_items, orders, carts,
      product_reviews, customers, import_jobs,
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
      platform_brand_asset_revisions, platform_brand_assets, platform_messages
    RESTART IDENTITY CASCADE
  `);
}

export async function seedSettings(prisma: PrismaClient): Promise<void> {
  await seedModule1Settings(prisma);
  await seedModule3Settings(prisma);
  await seedPlatformEventsSettings(prisma);
  await seedModule4Settings(prisma);
  await seedModerationSettings(prisma);
  await seedSupplierSettings(prisma);
  await seedOrdersSettings(prisma);
  await seedOrderVerificationSettings(prisma);
  await seedBillingSettings(prisma);
  await seedWalletSettings(prisma);
  await seedTrustSafetySettings(prisma);
  await seedAccountSecuritySettings(prisma);
  await seedOnboardingSettings(prisma);
  await seedPlansSettings(prisma);
  await seedExternalApiSettings(prisma);
  await seedMessagingSettings(prisma);
  await seedImpersonationSettings(prisma);
  await seedGrowthProgramsSettings(prisma);
  await seedCareersSettings(prisma);
  await seedStoreHealthSettings(prisma);
  await seedVerificationSettings(prisma);
  await seedDataExportSettings(prisma);
  await seedInventorySettings(prisma);
  await seedWhatsAppMessagingSettings(prisma);
  // Themes aren't a Settings Registry concept, but every store-creation test
  // across every module needs at least one seeded theme to exist (Module 4
  // auto-assigns a default theme in StoresService.create()) - seeded
  // alongside settings for exactly that reason, not because it's settings data.
  await seedBuiltInThemes(prisma);
  // Same reasoning as themes above - every seller signup requires a current
  // Seller Agreement version to accept (SRS FR-29.1); reseeded fresh per
  // test file so a version published mid-suite by one test never leaks
  // into another file's run.
  await seedSellerAgreementV1(prisma);
  // Same reasoning again - AuthService.signup() assigns every new seller the
  // Free (individual, tier 0) plan (FR-7.1/7.3); that row must exist before
  // any test signs a seller up.
  await seedPlansData(prisma);
  // Templates module (v0.31 design phase) - depends on the paid plan rows
  // seedPlansData() just (re)created, so it must run after them.
  await seedTemplatesBrandingSettings(prisma);
  // Module 34 - depends on the same paid plan rows for its plan-tier quota key.
  await seedCampaignsSettings(prisma);
  // Module 35 - depends on the same paid plan rows for its plan-tier quota key.
  await seedStaffSettings(prisma);
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
