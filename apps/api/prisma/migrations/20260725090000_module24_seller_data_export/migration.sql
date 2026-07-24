-- CreateEnum
CREATE TYPE "DataExportTrigger" AS ENUM ('subscription_renewal', 'on_demand');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "DataExportDeliveryMethod" AS ENUM ('drive', 'email');

-- AlterTable
ALTER TABLE "google_drive_connections" ADD COLUMN     "export_folder_id" TEXT;

-- CreateTable
CREATE TABLE "seller_data_exports" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "trigger" "DataExportTrigger" NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'pending',
    "delivery_method" "DataExportDeliveryMethod",
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "products_csv_url" TEXT,
    "orders_csv_url" TEXT,
    "customers_csv_url" TEXT,
    "summary_pdf_url" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "seller_data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_seller_data_exports_seller_created" ON "seller_data_exports"("seller_id", "created_at");

-- AddForeignKey
ALTER TABLE "seller_data_exports" ADD CONSTRAINT "seller_data_exports_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
