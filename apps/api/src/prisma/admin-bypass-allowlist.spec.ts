import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

/**
 * D88 item 3 - PrismaAdminService bypasses every RLS policy by design (it
 * runs as a role with no tenant-scoping session variable ever set - see
 * prisma-admin.service.ts's own comment). That's correct for every file
 * below: each is either genuinely cross-tenant/admin-wide data (careers
 * postings, backups, platform settings, admin dashboards, staff/admin auth)
 * or a deliberately-reviewed mixed case (WalletService's admin-initiated
 * methods specifically - see its own class-level comment for the reasoning).
 *
 * This test is not a re-review of those files - it's a tripwire. The
 * moment a NEW file starts importing PrismaAdminService, this goes red
 * until a human deliberately adds it here, so a bypass call site can never
 * again silently accumulate the way these did before this test existed.
 * An entry that disappears (the file stopped using it, e.g. converted to
 * TenantPrismaService like this same item's WalletService/
 * SubscriptionInvoiceService work) must be removed here too, so the list
 * never drifts into claiming more bypass sites than actually exist.
 *
 * Generated mechanically against the codebase at the time this test was
 * written (`grep -rl "PrismaAdminService" --include="*.ts" src | grep -v
 * '\.spec\.ts$' | sort`), not hand-audited file by file - D88 item 4 (the
 * ~20 cross-tenant background-job queue review) and the M4 independent
 * security review are where that deeper review happens.
 */
const REVIEWED_PRISMA_ADMIN_CALL_SITES = [
  "src/admin-completion/admin-notifications.service.ts",
  "src/admin-completion/admin-overview.service.ts",
  "src/admin-completion/admin-search.service.ts",
  "src/admin-completion/admin-seller-overview.service.ts",
  "src/admin-email/admin-email-accounts.service.ts",
  // D82 - looks up an admin's own enrolled MFA secret for the step-up
  // re-check (SellerLifecycleService's own prismaAdmin usage for this was
  // already reviewed; this is that same lookup, moved here so it's shared).
  "src/auth/step-up-mfa.service.ts",
  "src/backups/backups.module.ts",
  "src/backups/database-backup.service.ts",
  "src/billing/email-templates.controller.ts",
  "src/billing/invoices.service.ts",
  "src/billing/paddle/admin-paddle-refund.controller.ts",
  "src/billing/paddle/founding-members.service.ts",
  "src/billing/paddle/paddle-billing.controller.ts",
  "src/billing/paddle/paddle-subscription-lifecycle.service.ts",
  "src/billing/plan-fee-debit.service.ts",
  "src/billing/program-commission.service.ts",
  "src/billing/renewal-reminders.service.ts",
  "src/billing/retention.service.ts",
  "src/billing/subscription-invoice.service.ts",
  "src/billing/subscription-refund.service.ts",
  "src/billing/supplier-wallet.service.ts",
  "src/billing/wallet-grace-ladder.service.ts",
  "src/billing/wallet-reconciliation.service.ts",
  "src/billing/wallet.controller.ts",
  "src/billing/wallet.service.ts",
  "src/branding/branding.service.ts",
  "src/buyer-account/buyer-account.service.ts",
  "src/buyer-chat/buyer-chat.service.ts",
  "src/campaigns/campaigns.module.ts",
  "src/campaigns/email-campaigns.service.ts",
  "src/careers/job-application.service.ts",
  "src/careers/job-posting.service.ts",
  "src/common/guards/admin-auth.guard.ts",
  "src/data-export/data-export.service.ts",
  "src/data-portability/product-import.service.ts",
  "src/deals/deals.service.ts",
  "src/domains/domain-verification.service.ts",
  "src/domains/domains.service.ts",
  "src/external-api/product-feed.service.ts",
  "src/finance-terminal/finance-terminal.service.ts",
  "src/gift-cards/gift-cards.service.ts",
  "src/growth-programs/growth-programs.module.ts",
  "src/growth-programs/program-application.service.ts",
  "src/growth-programs/program-report.service.ts",
  "src/growth-programs/program-reward.service.ts",
  "src/growth-programs/program-withdrawal.service.ts",
  "src/growth-programs/referral-attribution.service.ts",
  "src/guardrails/dormant-store.service.ts",
  "src/guardrails/mrr-analytics.service.ts",
  "src/guardrails/seller-health-funnel.service.ts",
  "src/guardrails/unit-economics.service.ts",
  "src/impersonation/impersonation.service.ts",
  "src/inventory/inventory.service.ts",
  "src/main.ts",
  "src/moderation/moderation.service.ts",
  "src/notifications/email.service.ts",
  "src/order-verification/order-verification.service.ts",
  "src/order-verification/seller-verification-emails.service.ts",
  "src/orders/cart.service.ts",
  "src/orders/checkout.service.ts",
  "src/orders/manual-transfer-auto-cancel.service.ts",
  "src/orders/missing-tracking-alert.service.ts",
  "src/orders/order-pricing.service.ts",
  "src/orders/order-status-lookup.service.ts",
  "src/orders/orders.service.ts",
  "src/payment-gateway/gateway-health.service.ts",
  "src/payment-gateway/payment-gateway.service.ts",
  // B2 - public, unauthenticated (Stripe has no session to present) -
  // the exact same "buyer-facing, no seller session" reason
  // payment-gateway.service.ts above is already on this list; looks up
  // the connection/order/store by storeId/orderId, never scoped by a
  // seller's own session.
  "src/payment-gateway/webhooks/stripe-webhook.controller.ts",
  // B2 - ProcessedWebhookEvent has no storeId/tenant column at all (a
  // webhook event ID is a fact about the provider's delivery, not a
  // seller's own data) - no RLS policy could apply to it regardless.
  "src/payment-gateway/webhooks/webhook-event-dedupe.service.ts",
  "src/plans/multi-store-downgrade.service.ts",
  "src/platform-gateway/platform-gateway-reconciliation.service.ts",
  "src/platform-gateway/platform-gateway.service.ts",
  "src/prisma/prisma-admin.service.ts",
  "src/prisma/prisma.module.ts",
  "src/returns/returns.service.ts",
  "src/reviews/reviews.service.ts",
  "src/seller-notifications/daily-sales-summary.service.ts",
  "src/seller-notifications/monthly-seller-report.service.ts",
  "src/seller-notifications/platform-newsletter.service.ts",
  "src/staff/staff-accounts.service.ts",
  "src/staff/staff-auth.service.ts",
  "src/store-health/store-health-score.service.ts",
  "src/store-settings/discount-codes.service.ts",
  "src/storefront/storefront.service.ts",
  "src/suppliers/printify/printify.adapter.ts",
  "src/suppliers/supplier-links.service.ts",
  "src/suppliers/supplier-listings.service.ts",
  "src/suppliers/supplier-orders.service.ts",
  "src/suppliers/supplier-portal.service.ts",
  "src/suppliers/supplier-sync.service.ts",
  "src/support-tickets/support-ticket-sla.service.ts",
  "src/support-tickets/support-tickets.service.ts",
  "src/teams/teams.service.ts",
  "src/theme-engine/dstudio-pack.service.ts",
  "src/theme-engine/template-purchase.service.ts",
  "src/trust-safety/payment-review-queue.service.ts",
  "src/trust-safety/risk-score.service.ts",
  "src/trust-safety/seller-lifecycle.service.ts",
  "src/trust-safety/subscription-abuse.service.ts",
  "src/trust-safety/trust-safety-monitors.service.ts",
  "src/verification/verification-application.service.ts",
  "src/verification/verification-eligibility.service.ts",
  "src/verification/verification-re-review.service.ts",
].sort();

function findReferencingFiles(dir: string, srcRoot: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findReferencingFiles(full, srcRoot));
      continue;
    }
    if (!entry.endsWith(".ts") || entry.endsWith(".spec.ts") || entry.endsWith(".d.ts")) continue;
    if (readFileSync(full, "utf8").includes("PrismaAdminService")) {
      found.push(relative(srcRoot, full).split(sep).join("/"));
    }
  }
  return found;
}

describe("PrismaAdminService bypass-client allowlist (D88 item 3)", () => {
  it("has no new, unreviewed call sites and no stale entries", () => {
    // apps/api/src/prisma -> apps/api (so results read "src/...", matching the allowlist above)
    const apiRoot = join(__dirname, "../..");
    const actual = findReferencingFiles(join(apiRoot, "src"), apiRoot).sort();

    const unreviewed = actual.filter((f) => !REVIEWED_PRISMA_ADMIN_CALL_SITES.includes(f));
    const stale = REVIEWED_PRISMA_ADMIN_CALL_SITES.filter((f) => !actual.includes(f));

    if (unreviewed.length > 0) {
      throw new Error(
        `New PrismaAdminService call site(s) not yet reviewed and added to REVIEWED_PRISMA_ADMIN_CALL_SITES in this file: ${unreviewed.join(", ")}`,
      );
    }
    if (stale.length > 0) {
      throw new Error(
        `REVIEWED_PRISMA_ADMIN_CALL_SITES lists file(s) that no longer reference PrismaAdminService - remove the stale entry: ${stale.join(", ")}`,
      );
    }
  });
});
