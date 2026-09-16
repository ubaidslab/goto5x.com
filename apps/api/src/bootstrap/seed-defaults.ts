import { PrismaClient } from "@prisma/client";
import { seedAccountSecuritySettings } from "../auth/account-security.seed";
import { seedAdminEmailSettings } from "../admin-email/admin-email.seed";
import { seedCampaignsSettings } from "../campaigns/campaigns.seed";
import { seedCareersSettings } from "../careers/careers.seed";
import { seedBuyerChatSettings } from "../buyer-chat/buyer-chat.seed";
import { seedWishlistSettings } from "../buyer-account/wishlist.seed";
import { seedDefaultCategories } from "../catalog/categories.seed";
import { seedCustomerSegmentsSettings } from "../customer-segments/customer-segments.seed";
import { seedDataExportSettings } from "../data-export/data-export.seed";
import { seedDealsSettings } from "../deals/deals.seed";
import { seedDesignTokensSettings } from "../design-tokens/design-tokens.seed";
import { seedOnboardingSettings } from "../auth/onboarding.seed";
import { seedBillingSettings } from "../billing/billing.seed";
import { seedSubscriptionReadinessSettings } from "../billing/subscription-readiness.seed";
import { seedEmailTemplates } from "../billing/email-templates.seed";
import { seedWalletSettings } from "../billing/wallet.seed";
import { seedPlatformGatewaySettings } from "../platform-gateway/platform-gateway.seed";
import { seedModerationSettings } from "../moderation/moderation.seed";
import { seedExternalApiClients, seedExternalApiSettings } from "../external-api/external-api.seed";
import { seedGiftCardsSettings } from "../gift-cards/gift-cards.seed";
import { seedGrowthProgramsSettings } from "../growth-programs/growth-programs.seed";
import { seedImpersonationSettings } from "../impersonation/impersonation.seed";
import { seedInventorySettings } from "../inventory/inventory.seed";
import { seedWhatsAppMessagingSettings } from "../whatsapp-messaging/whatsapp-messaging.seed";
import { seedMessagingSettings } from "../messaging/messaging.seed";
import { seedOrdersSettings } from "../orders/orders.seed";
import { seedOrderVerificationSettings } from "../orders/order-verification.seed";
import { seedPaymentModelSettings } from "../store-settings/payment-model.seed";
import { seedDeliveryTrackingSettings } from "../orders/delivery-tracking.seed";
import { seedPlansData, seedPlansSettings } from "../plans/plans.seed";
import { seedReviewsSettings } from "../reviews/reviews.seed";
import { seedReturnsSettings } from "../returns/returns.seed";
import { seedSeoAdvancedSettings } from "../storefront/seo-advanced.seed";
import { seedSellerNotificationsSettings } from "../seller-notifications/seller-notifications.seed";
import { seedModule1Settings, seedModule3Settings, seedPlatformEventsSettings } from "../settings-registry/settings.seed";
import { seedStaffSettings } from "../staff/staff.seed";
import { seedStoreHealthSettings } from "../store-health/store-health.seed";
import { seedStoresSettings } from "../tenancy/stores.seed";
import { seedSupplierSettings } from "../suppliers/suppliers.seed";
import { seedBuiltInThemes, seedModule4Settings, seedTemplatesBrandingSettings } from "../theme-engine/themes.seed";
import { seedSellerAgreementV1, seedTrustSafetySettings } from "../trust-safety/trust-safety.seed";
import { seedVerificationSettings } from "../verification/verification.seed";

/**
 * The single canonical list of "every default this platform needs to
 * function at all" - Settings Registry definitions, built-in themes, plans,
 * the current Seller Agreement version, email templates. Every individual
 * `seed*` function upserts its own rows with an empty `update: {}` (see
 * each module's own `*.seed.ts`), so this is idempotent and safe to call on
 * every single boot, including a redeploy against a database that already
 * has these rows - it only ever creates what's missing, never overwrites an
 * admin's real Settings Registry override or a seller's own customization.
 *
 * Historical bug this closes: this exact function body previously existed
 * ONLY as `seedSettings()` in test/e2e/setup.ts (still re-exported from
 * there for the ~100 e2e spec files that import it by that name) - meaning
 * a real deployment's first boot against a fresh database never ran any of
 * this, despite docs/launch-runbook.md explicitly (and, until this fix,
 * incorrectly) claiming it happened "automatically the first time the API
 * boots against a fresh database." A fresh install had zero
 * `SettingsDefinition` rows for most keys, so `SettingsService.resolve()`
 * threw `NotFoundException` on the very first call to almost any endpoint
 * (store details, theme settings, D-Studio, SEO fields, etc.) - silently
 * swallowed by several frontend pages' bare `.catch(() => {})` handlers
 * into a permanent loading spinner with no visible error. See main.ts's
 * `bootstrap()`, which now calls this for real.
 */
export async function seedDefaults(prisma: PrismaClient): Promise<void> {
  await seedModule1Settings(prisma);
  await seedModule3Settings(prisma);
  await seedPlatformEventsSettings(prisma);
  await seedModule4Settings(prisma);
  await seedModerationSettings(prisma);
  await seedSupplierSettings(prisma);
  await seedOrdersSettings(prisma);
  await seedOrderVerificationSettings(prisma);
  await seedPaymentModelSettings(prisma);
  await seedDeliveryTrackingSettings(prisma);
  await seedBillingSettings(prisma);
  await seedWalletSettings(prisma);
  await seedPlatformGatewaySettings(prisma);
  await seedTrustSafetySettings(prisma);
  await seedAccountSecuritySettings(prisma);
  await seedOnboardingSettings(prisma);
  await seedPlansSettings(prisma);
  await seedExternalApiSettings(prisma);
  await seedExternalApiClients(prisma);
  await seedMessagingSettings(prisma);
  await seedImpersonationSettings(prisma);
  await seedGrowthProgramsSettings(prisma);
  await seedCareersSettings(prisma);
  await seedStoreHealthSettings(prisma);
  await seedVerificationSettings(prisma);
  await seedInventorySettings(prisma);
  await seedWhatsAppMessagingSettings(prisma);
  await seedDefaultCategories(prisma);
  await seedBuiltInThemes(prisma);
  await seedSellerAgreementV1(prisma);
  await seedPlansData(prisma);
  await seedTemplatesBrandingSettings(prisma);
  await seedCampaignsSettings(prisma);
  await seedStaffSettings(prisma);
  await seedDataExportSettings(prisma);
  await seedSubscriptionReadinessSettings(prisma);
  await seedEmailTemplates(prisma);
  await seedSeoAdvancedSettings(prisma);
  await seedStoresSettings(prisma);
  await seedAdminEmailSettings(prisma);
  await seedGiftCardsSettings(prisma);
  await seedDealsSettings(prisma);
  await seedDesignTokensSettings(prisma);
  await seedCustomerSegmentsSettings(prisma);
  await seedReviewsSettings(prisma);
  await seedReturnsSettings(prisma);
  await seedSellerNotificationsSettings(prisma);
  await seedBuyerChatSettings(prisma);
  await seedWishlistSettings(prisma);
}
