import { PrismaClient } from "@prisma/client";

/**
 * Module 97 (SRS §5.38/FR-38.8-38.9, founder batch "Honest Delivery
 * Tracking") - Settings Registry keys for the buyer-facing 4-state
 * tracking messages and the delivered-order display-archival window.
 */
export async function seedDeliveryTrackingSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "orders.tracking_message_pending" },
    create: {
      key: "orders.tracking_message_pending",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue: "Your order is being packed and will be handed to the courier soon!",
      description: "Seller-editable buyer-facing message for the 'Pending' tracking state (FR-38.7/38.8).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.tracking_message_submitted" },
    create: {
      key: "orders.tracking_message_submitted",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue: "Your order has been handed to the courier and is on its way!",
      description: "Seller-editable buyer-facing message for the 'Submitted to Courier' tracking state (FR-38.7/38.8).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.tracking_message_delivered" },
    create: {
      key: "orders.tracking_message_delivered",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue: "Your order has been delivered. We hope you love it!",
      description: "Seller-editable buyer-facing message for the 'Delivered' tracking state (FR-38.7/38.8).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.tracking_message_cancelled" },
    create: {
      key: "orders.tracking_message_cancelled",
      valueType: "string",
      allowedScopes: ["store", "global"],
      defaultValue: "This order has been cancelled.",
      description: "Seller-editable buyer-facing message for the 'Cancelled' tracking state (FR-38.7/38.8).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.delivered_archive_days" },
    create: {
      key: "orders.delivered_archive_days",
      valueType: "number",
      allowedScopes: ["store", "global"],
      defaultValue: 7,
      validation: { min: 1, max: 90 },
      description:
        "Days after entering the 'Delivered' bucket before the buyer-facing status page collapses to a simple summary (FR-38.9). Display simplification only - never deletes or excludes the underlying order from any other read.",
    },
    update: {},
  });
}
