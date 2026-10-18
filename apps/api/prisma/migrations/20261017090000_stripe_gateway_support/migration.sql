-- B2 (founder-approved design, D117) - Stripe sandbox adapter support.

-- Add "stripe" as a connectable provider alongside raast/easypaisa/jazzcash/bank.
ALTER TYPE "PaymentGatewayProvider" ADD VALUE 'stripe';

-- Per-store webhook signing secret (Stripe-only), encrypted under the same
-- per-row data key as apiKeyEncrypted/apiSecretEncrypted.
ALTER TABLE "store_payment_gateway_connections" ADD COLUMN "webhook_secret_encrypted" TEXT;

-- Permanent, provider-agnostic dedupe for inbound webhook event IDs - see
-- schema.prisma's own comment on this model for why this is a dedicated
-- table rather than the existing Redis-backed IdempotencyService.
CREATE TABLE "processed_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_provider_event" ON "processed_webhook_events"("provider", "event_id");
