import { PrismaClient } from "@prisma/client";

/**
 * Module 12's real settings keys - risk-score weights/thresholds (FR-30.5),
 * anti-underreporting monitor thresholds (FR-6.19/FR-29.3), and the
 * bypass-attempt window/count (FR-29.3). All Settings-Registry-tunable,
 * matching every other rule engine this SRS specifies (§5.27, FR-23.5) -
 * never hard-coded.
 */
export async function seedTrustSafetySettings(prisma: PrismaClient) {
  const numberDef = async (
    key: string,
    defaultValue: number,
    description: string,
    validation?: { min?: number; max?: number },
  ) =>
    prisma.settingsDefinition.upsert({
      where: { key },
      create: { key, valueType: "number", allowedScopes: ["global"], defaultValue, validation, description },
      update: {},
    });

  // FR-30.5 risk-score weights (points added to the score per bad signal).
  await numberDef("trust_safety.risk_weight_email_unverified", 20, "Points added if the seller's email is not yet verified at signup (FR-30.5).", { min: 0, max: 100 });
  await numberDef("trust_safety.risk_weight_cnic_missing_or_invalid", 30, "Points added if no valid CNIC is on file yet (FR-30.5).", { min: 0, max: 100 });
  await numberDef("trust_safety.risk_weight_name_mismatch", 25, "Points added if a payment instrument's name-consistency status is pending/rejected (FR-30.5).", { min: 0, max: 100 });
  await numberDef("trust_safety.risk_weight_account_reuse", 100, "Points added if a payment fingerprint reuse was ever detected for this seller (FR-30.5) - already hard-blocked by FR-30.3, this just reflects it in the score.", { min: 0, max: 200 });
  await numberDef("trust_safety.risk_weight_device_ip_flag", 15, "Points added for a device-fingerprint/IP signal alone - deliberately low: must never cross the block threshold by itself (FR-30.5).", { min: 0, max: 100 });
  await numberDef("trust_safety.risk_weight_business_name_similarity", 10, "Points added if this seller's business name is suspiciously similar to another seller's (FR-30.5).", { min: 0, max: 100 });

  // FR-30.5 outcome thresholds.
  await numberDef("trust_safety.risk_threshold_manual_review", 30, "Risk score at/above which activation resolves to manual_review instead of auto_approved (FR-30.5).", { min: 1, max: 500 });
  await numberDef("trust_safety.risk_threshold_block", 60, "Risk score at/above which activation resolves to blocked (FR-30.5).", { min: 1, max: 500 });

  // FR-6.19/FR-29.3 anti-underreporting monitors.
  await numberDef("trust_safety.cancellation_rate_window_days", 30, "Rolling window (days) the cancellation-rate monitor looks back over (FR-6.19).", { min: 1, max: 365 });
  await numberDef("trust_safety.cancellation_rate_threshold_percent", 30, "Cancellation rate (%) over the window above which a seller is flagged (FR-6.19).", { min: 1, max: 100 });
  await numberDef("trust_safety.pending_forever_max_age_days", 14, "An order older than this, still pending, counts toward the pending-forever rate (FR-6.19).", { min: 1, max: 365 });
  await numberDef("trust_safety.pending_forever_rate_threshold_percent", 20, "Pending-forever rate (%) above which a seller is flagged (FR-6.19).", { min: 1, max: 100 });
  await numberDef("trust_safety.monitor_min_sample_orders", 5, "Minimum order count in the window before either rate monitor can fire - avoids flagging tiny samples (FR-6.19).", { min: 1, max: 1000 });

  // FR-29.3 signup-velocity flag (distinct from FR-23.5's hard rate-limit reject) and bypass-attempt detection.
  await numberDef("trust_safety.signup_velocity_flag_window_minutes", 60, "Window (minutes) the signup-velocity T&S flag counts signups per IP over (FR-29.3).", { min: 1, max: 1440 });
  await numberDef("trust_safety.signup_velocity_flag_threshold", 5, "Signups from the same IP within the window above which a T&S flag fires (FR-29.3) - a review signal, separate from FR-23.5's hard per-hour reject.", { min: 1, max: 1000 });
  await numberDef("trust_safety.bypass_attempt_window_minutes", 60, "Window (minutes) the bypass-attempt monitor counts blocked/queued submissions over (FR-29.3).", { min: 1, max: 1440 });
  await numberDef("trust_safety.bypass_attempt_count_threshold", 3, "Blocked/queued moderation attempts from the same seller within the window above which a bypass-attempt flag fires (FR-29.3).", { min: 1, max: 100 });
}

/**
 * Seeds the v1.0 Seller Agreement version row (FR-29.1) - "current" is
 * simply the highest publishedAt row, so seeding one row makes it current.
 */
export async function seedSellerAgreementV1(prisma: PrismaClient) {
  await prisma.sellerAgreementVersion.upsert({
    where: { version: "1.0" },
    create: { version: "1.0" },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  Promise.all([seedTrustSafetySettings(prisma), seedSellerAgreementV1(prisma)])
    .then(() => console.log("Module 12 (Trust & Safety) settings + agreement v1.0 seeded."))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
