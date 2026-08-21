-- SRS §5.6k (v0.41) - Subscription Business Readiness, re-amended for the
-- subscription-only model. Schema for Modules 64/65/66/67/68/71/90.

CREATE TYPE "TicketStatus" AS ENUM ('open', 'resolved');

-- Module 64/66 - the two distinct pause-reason timers, never shared.
ALTER TABLE "stores" ADD COLUMN "terminal_paused_at" TIMESTAMPTZ;
ALTER TABLE "stores" ADD COLUMN "over_limit_paused_at" TIMESTAMPTZ;

-- Module 67 - rolling gateway-health counters.
ALTER TABLE "store_payment_gateway_connections" ADD COLUMN "verified_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "store_payment_gateway_connections" ADD COLUMN "failed_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "store_payment_gateway_connections" ADD COLUMN "last_verified_at" TIMESTAMPTZ;
ALTER TABLE "store_payment_gateway_connections" ADD COLUMN "last_checked_at" TIMESTAMPTZ;

-- Module 65 - admin-editable email template copy. Global, admin-only; no
-- RLS (never touched by TenantPrismaService, same as SettingsDefinition).
CREATE TABLE "email_templates" (
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("key")
);

-- Module 90 - the minimal support-ticket system.
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "sla_deadline" TIMESTAMPTZ NOT NULL,
    "near_breach_notified_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "author_type" TEXT NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- Module 71 - durable identity-match flags. Admin-only (PlatformEvent's
-- own "never a seller-facing/tenant-scoped read" precedent) - no RLS.
CREATE TABLE "subscription_abuse_flags" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "matched_signal" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_abuse_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_support_tickets_store" ON "support_tickets"("store_id");
CREATE INDEX "idx_support_tickets_status_deadline" ON "support_tickets"("status", "sla_deadline");
CREATE INDEX "idx_ticket_messages_ticket" ON "ticket_messages"("ticket_id");
CREATE INDEX "idx_subscription_abuse_flags_seller" ON "subscription_abuse_flags"("seller_id");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_abuse_flags" ADD CONSTRAINT "subscription_abuse_flags_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store_id-through-stores-subquery pattern proven since Module 2.
ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_tickets" FORCE ROW LEVEL SECURITY;
CREATE POLICY support_tickets_seller_isolation ON "support_tickets"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "ticket_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY ticket_messages_seller_isolation ON "ticket_messages"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
