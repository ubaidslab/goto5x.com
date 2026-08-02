import { PrismaClient } from "@prisma/client";

/** Module 26's Settings Registry keys (SRS §5.37, FR-37.1/37.3/37.5). */
export async function seedOrderVerificationSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "orders.verification_channel" },
    create: {
      key: "orders.verification_channel",
      valueType: "string",
      // Per-store choice (FR-37.1) - the first real use of the Settings
      // Registry's "store" scope (previously supported by scopeIdFor()
      // but never exercised by an earlier module).
      allowedScopes: ["store", "global"],
      defaultValue: "none",
      description:
        'One of "none" / "whatsapp_otp" / "email_otp" / "prepaid_confirmation" - the order-verification channel this store uses (FR-37.1). An unrecognized value is treated as "none" defensively, never as an error that blocks checkout.',
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.verification_otp_ttl_minutes" },
    create: {
      key: "orders.verification_otp_ttl_minutes",
      valueType: "number",
      allowedScopes: ["store", "global"],
      defaultValue: 10,
      validation: { min: 5, max: 60 },
      description: "How long an order-verification OTP stays valid before expiring (FR-37.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.verification_otp_resend_cooldown_seconds" },
    create: {
      key: "orders.verification_otp_resend_cooldown_seconds",
      valueType: "number",
      allowedScopes: ["store", "global"],
      defaultValue: 60,
      validation: { min: 15, max: 900 },
      description: "Minimum time between OTP resend requests for the same order (FR-37.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.verification_otp_max_attempts" },
    create: {
      key: "orders.verification_otp_max_attempts",
      valueType: "number",
      allowedScopes: ["store", "global"],
      defaultValue: 5,
      validation: { min: 3, max: 10 },
      description: "Wrong-code submissions allowed against one OTP before that verification attempt fails (FR-37.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.verification_email_daily_send_cap" },
    create: {
      key: "orders.verification_email_daily_send_cap",
      valueType: "number",
      allowedScopes: ["store", "global"],
      defaultValue: 450,
      validation: { min: 1, max: 10000 },
      description: "Daily OTP-send cap per connected sender email, rotating across a seller's connected senders once hit (FR-37.3).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.verification_message_template" },
    create: {
      key: "orders.verification_message_template",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue: "Your order verification code is {{otp}}. It expires in a few minutes - do not share it with anyone.",
      description: "Seller-editable OTP message template; {{otp}} is interpolated at send time (FR-37.6).",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedOrderVerificationSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Order verification settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
