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
        "Price for a future extra-device-slot add-on (mechanism now, monetization/checkout decision at launch, FR-25.7) - no billing flow reads this yet.",
    },
    update: {},
  });
}
