-- CreateEnum
CREATE TYPE "OrderVerificationChannel" AS ENUM ('whatsapp_otp', 'email_otp', 'prepaid_confirmation');

-- CreateEnum
CREATE TYPE "OrderVerificationStatus" AS ENUM ('pending', 'verified', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "SellerVerificationEmailStatus" AS ENUM ('active', 'revoked');

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "buyer_whatsapp" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "buyer_whatsapp" TEXT;

-- AlterTable
ALTER TABLE "seller_data_exports" ADD COLUMN     "inventory_csv_key" TEXT;

-- CreateTable
CREATE TABLE "order_verifications" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "channel" "OrderVerificationChannel" NOT NULL,
    "status" "OrderVerificationStatus" NOT NULL DEFAULT 'pending',
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMPTZ,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "sender_email_id" UUID,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "order_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_verification_emails" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "email_address" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_username" TEXT NOT NULL,
    "smtp_password_encrypted" TEXT NOT NULL,
    "daily_send_count" INTEGER NOT NULL DEFAULT 0,
    "daily_send_count_reset_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SellerVerificationEmailStatus" NOT NULL DEFAULT 'active',
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_verification_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "adjusted_by_user_id" UUID NOT NULL,
    "quantity_before" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_verifications_order_id_key" ON "order_verifications"("order_id");

-- CreateIndex
CREATE INDEX "idx_order_verifications_store_id" ON "order_verifications"("store_id");

-- CreateIndex
CREATE INDEX "idx_seller_verification_emails_seller_status" ON "seller_verification_emails"("seller_id", "status");

-- CreateIndex
CREATE INDEX "idx_stock_adjustments_store_created" ON "stock_adjustments"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_stock_adjustments_variant" ON "stock_adjustments"("product_variant_id");

-- AddForeignKey
ALTER TABLE "order_verifications" ADD CONSTRAINT "order_verifications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_verifications" ADD CONSTRAINT "order_verifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_verifications" ADD CONSTRAINT "order_verifications_sender_email_id_fkey" FOREIGN KEY ("sender_email_id") REFERENCES "seller_verification_emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_verification_emails" ADD CONSTRAINT "seller_verification_emails_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store_id-through-stores-subquery pattern proven since Module 2,
-- same as order_notes/order_timeline_events/tracking_updates and Module
-- 23's store_health_score_history. seller_verification_emails is
-- deliberately seller-scoped only (no store_id), same category as
-- Seller/Subscription/SellerDataExport - no RLS policy of its own,
-- accessed via PrismaAdminService + explicit sellerId filtering instead.
ALTER TABLE "order_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_verifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_verifications_seller_isolation ON "order_verifications"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "stock_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_adjustments" FORCE ROW LEVEL SECURITY;
CREATE POLICY stock_adjustments_seller_isolation ON "stock_adjustments"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

-- RevokeUpdateDelete (Module 26/28 - seller-facing append-only history,
-- same immutability discipline as admin_audit_logs/user_security_events,
-- FR-8.9): stock_adjustments must never be editable or deletable via the
-- application, only insertable/readable.
REVOKE UPDATE, DELETE ON "stock_adjustments" FROM app_runtime, app_admin;
