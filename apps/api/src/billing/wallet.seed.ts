import { PrismaClient } from "@prisma/client";

/**
 * Module 20 (SRS §5.6e, FR-6.21/6.24/6.25/6.26). Two thresholds are
 * deliberately separate keys, named so the distinction is obvious in the
 * admin settings UI: `wallet_low_balance_warning_threshold` is a positive
 * "getting risky, top up soon" line that starts the gentle warn-then-grace
 * ladder; `wallet_negative_float_floor` is a negative line that a debit is
 * always allowed to cross (it never fails or rolls back a sale) but that
 * immediately pauses the seller's stores the moment it's crossed, bypassing
 * the grace ladder entirely. They answer different questions and are never
 * meant to be the same value.
 */
export async function seedWalletSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.wallet_min_initial_topup" },
    create: {
      key: "billing.wallet_min_initial_topup",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 500,
      validation: { min: 0 },
      description: "The minimum wallet top-up (PKR) required before a seller can publish a store and start accepting real orders (SRS FR-6.21).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.wallet_low_balance_warning_threshold" },
    create: {
      key: "billing.wallet_low_balance_warning_threshold",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 200,
      validation: { min: 0 },
      description: "Wallet balance (PKR, positive) below which a seller sees a dashboard warning and receives a warning email - the START of the low-balance grace ladder (SRS FR-6.25). Distinct from the negative-float floor below.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.wallet_grace_days" },
    create: {
      key: "billing.wallet_grace_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 3,
      validation: { min: 0, max: 30 },
      description: "Days after a low-balance warning before an unrestored store enters orders_paused (SRS FR-6.25).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.wallet_negative_float_floor" },
    create: {
      key: "billing.wallet_negative_float_floor",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: -100,
      validation: { max: 0 },
      description: "The most negative (PKR) a wallet balance is allowed to run before its stores pause. The commission debit itself never fails or rolls back mid-transaction even if it crosses this line - but the moment balance is below it, active stores pause immediately, bypassing the grace ladder (SRS FR-6.26). Distinct from the low-balance warning threshold above: this is a hard floor, not a warning line.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.wallet_topup_presets" },
    create: {
      key: "billing.wallet_topup_presets",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [500, 1000, 2500, 5000],
      description: "Preset top-up amounts (PKR) shown on the seller wallet top-up screen, alongside a custom-amount option (SRS FR-6.23/FR-6.27).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.plan_fee_debit_check_hours" },
    create: {
      key: "billing.plan_fee_debit_check_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the monthly-in-advance plan-fee/team-seat/device-slot wallet-debit sweep runs (idempotent - safe to run more often than monthly) (SRS FR-6.24).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.wallet_low_balance_sweep_hours" },
    create: {
      key: "billing.wallet_low_balance_sweep_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the wallet low-balance grace-ladder sweep runs (SRS FR-6.25).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  // Module 47 (new FR-6.29) - the daily wallet-balance reconciliation
  // sweep, same "settings-driven interval hours" pattern as the two
  // schedulers above (default 24h = daily, per the founder's requirement).
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.wallet_reconciliation_interval_hours" },
    create: {
      key: "billing.wallet_reconciliation_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the wallet-balance reconciliation sweep runs - recomputes each seller's true ledger sum and flags any drift from the cached WalletBalance column for admin review (SRS new FR-6.29).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  // Module 59 (SRS §5.6g, FR-6.33) - the wallet-credit portion of the
  // combined signup total (`firstCyclePrice + this`), a deliberately
  // Module 73 (v0.38) - DORMANT. The combined signup payment this key fed
  // (Module 59) is retired: signup/renewal now submit a plan-fee-only
  // payment (WalletService.getPlanFeePaymentPreview()/
  // requestPlanFeePayment()), never a bundled wallet top-up. Left seeded,
  // unread, same "kept not deleted" treatment as every other dormant
  // wallet-era key below - re-activatable if the wallet ever comes back.
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.minimum_signup_wallet_topup" },
    create: {
      key: "billing.minimum_signup_wallet_topup",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 699,
      validation: { min: 0 },
      description: "DORMANT (v0.38) - the wallet top-up (PKR) a combined signup payment used to bundle in, before Module 73 retired the combined-payment model in favor of a plan-fee-only payment. Unread.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  // Module 73 (v0.38, SRS §5.6g amended) - the subscription-only renewal
  // mechanism's grace window: a subscription becomes overdue at
  // Subscription.currentPeriodEnd, but PlanFeeDebitService's sweep only
  // pauses the seller's stores once currentPeriodEnd + this many days has
  // passed with no verified renewal payment - covering the ordinary lag
  // between "seller submitted a payment proof" and "admin verified it",
  // never punishing that lag as if it were non-payment.
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.plan_fee_grace_days" },
    create: {
      key: "billing.plan_fee_grace_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 3,
      validation: { min: 0, max: 30 },
      description: "Days past Subscription.currentPeriodEnd before a seller's stores pause for plan-fee non-payment (v0.38) - covers ordinary admin-verification lag on an already-submitted payment.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  // Module 20 (FR-7.10 supplement) - the actual gate the Supplier Premium
  // Plan's fee gets checked against, resolved with the same plan-scope
  // mechanism every other plan-gated feature already uses (FR-8.1) - see
  // Supplier.getPlanContext()/SupplierOrdersService. Not a `billing.*` key,
  // so unaffected by FR-8.16's confirm-step seeding.
  await prisma.settingsDefinition.upsert({
    where: { key: "suppliers.aggregated_dashboard_enabled" },
    create: {
      key: "suppliers.aggregated_dashboard_enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan", "supplier"],
      defaultValue: false,
      description: "Whether a supplier sees the unified cross-store aggregated order view (vs. one store at a time). Overridden to true on the Supplier Premium plan tier (SRS FR-7.10).",
    },
    update: {},
  });
}
