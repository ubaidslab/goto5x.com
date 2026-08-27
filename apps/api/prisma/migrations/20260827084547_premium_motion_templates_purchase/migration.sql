-- Premium Motion Templates (founder-approved scope addition). Adds a price
-- to Theme (null = not purchasable in-app) and a new
-- template_purchase_requests table - the seller-facing purchase claim that
-- reuses WalletTopUpRequest's exact "manual payment-instructions +
-- admin-confirms" shape rather than inventing a second payment system.
--
-- Note: `prisma migrate diff` spuriously proposes dropping
-- "idx_products_search"/"idx_products_tags", the search_vector column
-- default, and the og_image_media_id FKs, plus renaming several
-- pre-existing unique indexes - a known false positive with generated
-- tsvector columns + prisma's diff engine this repo has hit on every prior
-- migration. Stripped here, not applied - only the real changes below.

-- AlterEnum
ALTER TYPE "TemplateEntitlementSource" ADD VALUE 'platform_purchase';

-- AlterTable
ALTER TABLE "themes" ADD COLUMN "price" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "template_purchase_requests" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "theme_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" "TopUpRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ,
    "verified_by" UUID,

    CONSTRAINT "template_purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_template_purchases_seller_status" ON "template_purchase_requests"("seller_id", "status");

-- AddForeignKey
ALTER TABLE "template_purchase_requests" ADD CONSTRAINT "template_purchase_requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_purchase_requests" ADD CONSTRAINT "template_purchase_requests_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_purchase_requests" ADD CONSTRAINT "template_purchase_requests_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- template_purchase_requests is seller-scoped directly (not store-scoped) -
-- same predicate shape as template_entitlements/seller_api_tokens, not the
-- `stores` subquery every store-scoped table uses.
ALTER TABLE "template_purchase_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_purchase_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY template_purchase_requests_seller_isolation ON "template_purchase_requests"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);
