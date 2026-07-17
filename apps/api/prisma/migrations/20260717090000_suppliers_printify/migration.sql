-- Module 8 (Suppliers & Printify Adapter): suppliers, supplier_adapters
-- (FR-4.9 registry), store_supplier_links (FR-2.6/FR-3.1),
-- supplier_listings (FR-3.2/FR-4.x), listing_reviews (FR-2.7/FR-3.2).
-- Hand-written - `prisma migrate diff` proposed the same corrective
-- `DROP INDEX "idx_products_search"` / `ALTER TABLE "products" ALTER
-- COLUMN "search_vector" DROP DEFAULT` lines against the Module 5
-- generated column (same known issue, see docs/build-plan.md's Module 5
-- section), stripped from this file.

-- CreateEnum
CREATE TYPE "SupplierVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "StoreSupplierLinkStatus" AS ENUM ('pending_seller_review', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "InvitedBy" AS ENUM ('seller', 'supplier');

-- CreateEnum
CREATE TYPE "ListingReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "verification_status" "SupplierVerificationStatus" NOT NULL DEFAULT 'pending',
    "printify_shop_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_adapters" (
    "id" UUID NOT NULL,
    "adapter_type" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supplier_adapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_supplier_links" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "StoreSupplierLinkStatus" NOT NULL DEFAULT 'pending_seller_review',
    "invited_by" "InvitedBy" NOT NULL,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_supplier_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_listings" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "adapter_type" TEXT NOT NULL,
    "external_product_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 999999,
    "shipping_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimated_delivery_min_days" INTEGER NOT NULL,
    "estimated_delivery_max_days" INTEGER NOT NULL,
    "supported_countries" TEXT[],
    "raw_payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supplier_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_reviews" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "store_supplier_link_id" UUID NOT NULL,
    "supplier_listing_id" UUID NOT NULL,
    "status" "ListingReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "product_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_user_id_key" ON "suppliers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_adapters_adapter_type_key" ON "supplier_adapters"("adapter_type");

-- CreateIndex
CREATE INDEX "idx_ssl_supplier_status" ON "store_supplier_links"("supplier_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "store_supplier_links_store_id_supplier_id_key" ON "store_supplier_links"("store_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_listings_supplier_id_external_product_id_key" ON "supplier_listings"("supplier_id", "external_product_id");

-- CreateIndex
CREATE INDEX "idx_listing_reviews_link_status" ON "listing_reviews"("store_supplier_link_id", "status");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_supplier_links" ADD CONSTRAINT "store_supplier_links_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_supplier_links" ADD CONSTRAINT "store_supplier_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_listings" ADD CONSTRAINT "supplier_listings_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_store_supplier_link_id_fkey" FOREIGN KEY ("store_supplier_link_id") REFERENCES "store_supplier_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_supplier_listing_id_fkey" FOREIGN KEY ("supplier_listing_id") REFERENCES "supplier_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store_supplier_links and listing_reviews are tenant tables
-- (store_id) - same store_id-through-stores-subquery pattern proven since
-- Module 2. This protects the SELLER's own isolation guarantee only; the
-- SUPPLIER's cross-store view (FR-3.3) is a separate, deliberate
-- BYPASSRLS read path (see StoreSupplierLink's schema comment).
ALTER TABLE "store_supplier_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_supplier_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_supplier_links_seller_isolation ON "store_supplier_links"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "listing_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listing_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY listing_reviews_seller_isolation ON "listing_reviews"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

-- suppliers/supplier_adapters/supplier_listings are global tables (same
-- category as categories/themes/plans, docs/database-schema.md's tenant-
-- strategy note) - deliberately NOT row-level-secured. Supplier-side
-- isolation (a supplier only ever sees their OWN rows) is enforced at the
-- app layer via an explicit WHERE supplier_id = ... filter, same reasoning
-- as CategoriesController's global-read pattern.
