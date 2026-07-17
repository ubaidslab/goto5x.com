-- CreateEnum
CREATE TYPE "NavigationLocation" AS ENUM ('header', 'footer');

-- AlterTable
-- GENERATED ALWAYS AS ... STORED, not a plain column (docs/database-schema.md's
-- already-documented shape for this column, Module 5/FR-16.2). coalesce()
-- around `description` because it's nullable and `||` on NULL yields NULL,
-- which would silently drop the title-only half of every product with no
-- description from the index.
ALTER TABLE "products" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || coalesce(description, ''))) STORED;

-- CreateIndex
CREATE INDEX "idx_products_search" ON "products" USING GIN ("search_vector");

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_products" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_navigation_menus" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "location" "NavigationLocation" NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_navigation_menus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collections_store_id_slug_key" ON "collections"("store_id", "slug");

-- CreateIndex
CREATE INDEX "idx_collection_products_collection" ON "collection_products"("collection_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "collection_products_collection_id_product_id_key" ON "collection_products"("collection_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_navigation_menus_store_id_location_key" ON "store_navigation_menus"("store_id", "location");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_navigation_menus" ADD CONSTRAINT "store_navigation_menus_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
