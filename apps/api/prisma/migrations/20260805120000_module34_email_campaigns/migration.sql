-- Module 34 (SRS §5.51/FR-51.1-51.7) - Email Campaigns. Sends via the
-- seller's own connected SMTP sender (seller_verification_emails, reused
-- as-is from Module 26 - no new credential store); targets exactly one
-- saved segment (customer_segments, Module 33).

CREATE TYPE "EmailCampaignStatus" AS ENUM ('queued', 'sending', 'sent', 'failed');

CREATE TABLE "email_campaigns" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "sender_email_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'queued',
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_email_campaigns_store_created" ON "email_campaigns"("store_id", "created_at");

ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "customer_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_sender_email_id_fkey" FOREIGN KEY ("sender_email_id") REFERENCES "seller_verification_emails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same store_id-through-stores-subquery pattern proven since Module 2
-- (FR-51.1's cross-scope FK to seller_verification_emails mirrors
-- order_verifications.sender_email_id - the same precedent already
-- established in Module 26/schema.prisma).
ALTER TABLE "email_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_campaigns" FORCE ROW LEVEL SECURITY;
CREATE POLICY email_campaigns_seller_isolation ON "email_campaigns"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

-- Module 34 (FR-51.3) - permanent, store-scoped suppression from every
-- future campaign send. Nullable-timestamp-as-flag (this codebase's
-- established convention, e.g. connected_at/completed_at) rather than a
-- paired boolean+timestamp. Stores the RAW unsubscribe token (not
-- hashed, unlike password-reset/email-verify tokens) - it must be
-- re-derivable so the same link keeps working across every future
-- campaign; the worst case of it leaking is an unwanted unsubscribe, not
-- an account takeover. Lazily generated on first campaign send.
ALTER TABLE "customers" ADD COLUMN "unsubscribed_at" TIMESTAMPTZ;
ALTER TABLE "customers" ADD COLUMN "unsubscribe_token" TEXT;

CREATE UNIQUE INDEX "customers_unsubscribe_token_key" ON "customers"("unsubscribe_token");
