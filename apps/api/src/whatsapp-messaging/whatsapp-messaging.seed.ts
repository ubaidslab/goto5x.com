import { PrismaClient } from "@prisma/client";

/** Module 30's Settings Registry keys (SRS §5.41, FR-41.3) - seller-editable per-trigger message templates. */
export async function seedWhatsAppMessagingSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "whatsapp.order_confirmation_template" },
    create: {
      key: "whatsapp.order_confirmation_template",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue:
        "Hi! Your order #{{order_number}} from {{store_name}} is confirmed. Total: {{currency}} {{total}}. Thank you for shopping with us!",
      description:
        "Seller-editable WhatsApp order-confirmation message; {{order_number}}/{{store_name}}/{{total}}/{{currency}} are interpolated at generation time (FR-41.1a/41.3).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "whatsapp.shipping_update_template" },
    create: {
      key: "whatsapp.shipping_update_template",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue: "Hi! Your order #{{order_number}} from {{store_name}} has shipped. Tracking ID: {{tracking_id}} ({{carrier}}).",
      description:
        "Seller-editable WhatsApp shipping-update message; {{order_number}}/{{store_name}}/{{tracking_id}}/{{carrier}} are interpolated at generation time (FR-41.1b/41.3).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "whatsapp.cart_recovery_template" },
    create: {
      key: "whatsapp.cart_recovery_template",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue: "Hi! You left {{item_summary}} in your cart at {{store_name}}. Complete your order here: {{store_link}}",
      description:
        "Seller-editable WhatsApp abandoned-cart recovery message; {{item_summary}}/{{store_name}}/{{store_link}} are interpolated at generation time (FR-41.1c/41.3).",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedWhatsAppMessagingSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("WhatsApp messaging settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
