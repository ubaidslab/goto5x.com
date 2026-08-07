import { PrismaClient } from "@prisma/client";

/**
 * Module 13's real settings keys (SRS §5.25/FR-25.6-25.7). All Settings-
 * Registry-tunable, matching every other gate this SRS specifies - never
 * hard-coded.
 */
export async function seedAccountSecuritySettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "auth.seller_mfa_enforcement" },
    create: {
      key: "auth.seller_mfa_enforcement",
      valueType: "string",
      allowedScopes: ["global", "plan"],
      defaultValue: "optional",
      description:
        "Seller TOTP 2FA enforcement mode: optional | required_for_payout_actions | required_always (FR-25.6).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "auth.max_concurrent_devices" },
    create: {
      key: "auth.max_concurrent_devices",
      valueType: "number",
      allowedScopes: ["global", "plan", "seller"],
      defaultValue: 3,
      validation: { min: 1, max: 100 },
      description:
        "Maximum concurrent active sessions/devices for a seller; seller-scope override represents a purchased extra-device-slot add-on (FR-25.7).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "auth.extra_device_slot_price" },
    create: {
      key: "auth.extra_device_slot_price",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 0,
      validation: { min: 0 },
      description:
        "Price for the extra-device-slot add-on, debited monthly from the seller's wallet for as long as a seller-scoped auth.max_concurrent_devices override exists (Module 20, FR-25.7/FR-6.24).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "auth.mfa_verify_rate_limit_per_hour" },
    create: {
      key: "auth.mfa_verify_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1000 },
      description:
        "Maximum TOTP code attempts per account and per IP per hour on /auth/mfa/verify and /admin/auth/mfa/verify (Phase B pre-launch audit finding - a 6-digit code is a genuinely guessable space with a valid preAuthToken, unlike the 256-bit email-verification token).",
    },
    update: {},
  });
}
