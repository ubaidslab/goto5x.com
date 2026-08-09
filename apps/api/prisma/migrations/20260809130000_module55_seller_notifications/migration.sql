-- Module 55 (SRS §5.62/FR-62.1-62.4) - Seller Notifications: per-seller
-- newsletter opt-out, the low-stock-alert debounce marker, and the
-- admin-composed platform newsletter (platform SMTP sender, not tenant-
-- scoped - no RLS needed).

ALTER TABLE "sellers" ADD COLUMN "newsletter_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sellers" ADD COLUMN "newsletter_unsubscribe_token" TEXT;
CREATE UNIQUE INDEX "sellers_newsletter_unsubscribe_token_key" ON "sellers"("newsletter_unsubscribe_token");

ALTER TABLE "product_variants" ADD COLUMN "low_stock_alert_sent_at" TIMESTAMPTZ;

CREATE TYPE "PlatformNewsletterStatus" AS ENUM ('draft', 'sending', 'sent', 'failed');

CREATE TABLE "platform_newsletters" (
    "id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "PlatformNewsletterStatus" NOT NULL DEFAULT 'draft',
    "created_by_admin_id" UUID NOT NULL,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "platform_newsletters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_platform_newsletters_created" ON "platform_newsletters"("created_at");

ALTER TABLE "platform_newsletters" ADD CONSTRAINT "platform_newsletters_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No RLS: platform-wide, admin-only table, same as e.g. admin_users itself.
