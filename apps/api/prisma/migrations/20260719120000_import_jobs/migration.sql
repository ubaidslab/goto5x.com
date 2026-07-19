-- Module 15 (FR-18.1-18.3): Data Portability (CSV Import/Export).
--
-- Note: `prisma migrate diff` spuriously proposes dropping "idx_products_search"
-- and the search_vector column default. This is a known false positive (Prisma's
-- diff engine does not understand the GENERATED ALWAYS AS search_vector column
-- from Module 5) and both lines have been stripped from this migration.

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('product_import', 'product_export', 'order_export');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- AlterEnum
ALTER TYPE "MediaSource" ADD VALUE 'csv_import';

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "type" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'pending',
    "file_url" TEXT NOT NULL,
    "unmapped_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error_log" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_import_jobs_store_status" ON "import_jobs"("store_id", "status");

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store_id-through-stores-subquery pattern proven since Module 2.
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY import_jobs_seller_isolation ON "import_jobs"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

