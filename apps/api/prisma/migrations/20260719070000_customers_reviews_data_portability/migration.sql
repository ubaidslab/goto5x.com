-- Module 15: Customers, Reviews & Data Portability (FR-13.1-13.3, FR-14.1-14.4,
-- FR-18.1-18.3, FR-19.1-19.3).
--
-- Note: `prisma migrate diff` spuriously proposes dropping "idx_products_search"
-- and the search_vector column default. This is a known false positive (Prisma's
-- diff engine does not understand the GENERATED ALWAYS AS search_vector column
-- from Module 5) and both lines have been stripped from this migration.

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'hidden');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_id" UUID,
ADD COLUMN     "invoice_pdf_url" TEXT;

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "first_order_at" TIMESTAMPTZ,
    "last_order_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" UUID,
    "buyer_name" TEXT NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_customers_store_spent" ON "customers"("store_id", "total_spent");

-- CreateIndex
CREATE UNIQUE INDEX "customers_store_id_email_key" ON "customers"("store_id", "email");

-- CreateIndex
CREATE INDEX "idx_reviews_product_status" ON "product_reviews"("product_id", "status");

-- CreateIndex
CREATE INDEX "idx_reviews_store_status" ON "product_reviews"("store_id", "status");

-- CreateIndex
CREATE INDEX "idx_orders_customer" ON "orders"("customer_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint: rating must be 1-5 (FR-14.1), not expressible in Prisma's schema DSL.
ALTER TABLE "product_reviews" ADD CONSTRAINT "chk_review_rating" CHECK ("rating" BETWEEN 1 AND 5);

-- RLS: store_id-through-stores-subquery pattern proven since Module 2.
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY customers_seller_isolation ON "customers"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "product_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY product_reviews_seller_isolation ON "product_reviews"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

