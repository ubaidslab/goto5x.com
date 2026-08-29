-- Known Prisma diff-engine false positive (documented in every prior
-- migration in this repo): a fresh `prisma migrate dev` diff against this
-- schema always includes spurious drops/recreates of the og_image_media_id
-- FKs, idx_products_search/idx_products_tags/idx_order_verifications_store_id,
-- the products.search_vector default, an unrelated column type coercion, and
-- RenameIndex noise for indexes whose Prisma-inferred name differs from the
-- DB's actual name. None of that reflects an intended change here - only the
-- Deal/DealItem tables and orders.deal_id below are real (Module 91,
-- SRS §5.67/FR-67.1-67.2).

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('draft', 'active', 'archived');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deal_id" UUID;

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_media_id" UUID,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_items" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "deal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_deals_store_status" ON "deals"("store_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "deals_store_id_slug_key" ON "deals"("store_id", "slug");

-- CreateIndex
CREATE INDEX "idx_deal_items_deal" ON "deal_items"("deal_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "deal_items_deal_id_variant_id_key" ON "deal_items"("deal_id", "variant_id");

-- CreateIndex
CREATE INDEX "idx_orders_deal" ON "orders"("deal_id");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_thumbnail_media_id_fkey" FOREIGN KEY ("thumbnail_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_items" ADD CONSTRAINT "deal_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: same store_id-through-stores-subquery pattern proven since Module 2
-- (prisma/migrations/20260716104650_catalog_rls_and_drive_grants/migration.sql),
-- matching discount_codes' shape immediately above it in schema.prisma.
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deals" FORCE ROW LEVEL SECURITY;
CREATE POLICY deals_seller_isolation ON "deals"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "deal_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY deal_items_seller_isolation ON "deal_items"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );
