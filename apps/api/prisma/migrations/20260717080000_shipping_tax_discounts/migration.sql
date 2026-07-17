-- Module 7 (Shipping, Tax & Discounts): store_shipping_settings (FR-2.10),
-- store_tax_settings (FR-19.3), discount_codes (FR-2.11). Hand-written -
-- `prisma migrate diff` proposed corrective `DROP INDEX "idx_products_search"`
-- / `ALTER TABLE "products" ALTER COLUMN "search_vector" DROP DEFAULT` lines
-- against the Module 5 generated column again (same known issue documented
-- in docs/build-plan.md's Module 5 section), stripped from this file.

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed_amount');

-- CreateTable
CREATE TABLE "store_shipping_settings" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "flat_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "free_shipping_threshold" DECIMAL(12,2),
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_shipping_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_tax_settings" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "tax_label" TEXT NOT NULL DEFAULT 'Tax',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_tax_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_shipping_settings_store_id_key" ON "store_shipping_settings"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_tax_settings_store_id_key" ON "store_tax_settings"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_store_id_code_key" ON "discount_codes"("store_id", "code");

-- AddForeignKey
ALTER TABLE "store_shipping_settings" ADD CONSTRAINT "store_shipping_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_tax_settings" ADD CONSTRAINT "store_tax_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same store_id-through-stores-subquery pattern proven since Module 2
-- (prisma/migrations/20260716104650_catalog_rls_and_drive_grants/migration.sql).
ALTER TABLE "store_shipping_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_shipping_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_shipping_settings_seller_isolation ON "store_shipping_settings"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "store_tax_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_tax_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_tax_settings_seller_isolation ON "store_tax_settings"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "discount_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_codes" FORCE ROW LEVEL SECURITY;
CREATE POLICY discount_codes_seller_isolation ON "discount_codes"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );
