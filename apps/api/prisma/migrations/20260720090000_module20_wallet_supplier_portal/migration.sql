-- Module 20 (SRS v0.24 §5.6e, FR-6.21-6.28, FR-7.10 supplement).
-- Prepaid Credits Wallet + Supplier Portal Completion.
--
-- Two lines this diff would otherwise include are stripped as a known
-- false positive (see docs/build-plan.md's Module 5/theme-engine note on
-- `idx_products_search`/`products.search_vector`): Prisma's migration
-- diffing cannot represent the `GENERATED ALWAYS AS ... STORED` column
-- correctly and proposes to drop/recreate its index and default on every
-- unrelated migration. Not touched here - same as every migration since.

-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('seller', 'supplier');

-- CreateEnum
CREATE TYPE "TopUpRequestStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "SupplierLedgerEntryType" AS ENUM ('topup_credit', 'plan_fee_debit');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'wallet_topup_credit';
ALTER TYPE "LedgerEntryType" ADD VALUE 'wallet_plan_fee_debit';
ALTER TYPE "LedgerEntryType" ADD VALUE 'wallet_team_seat_fee_debit';
ALTER TYPE "LedgerEntryType" ADD VALUE 'wallet_device_slot_fee_debit';

-- AlterEnum
ALTER TYPE "SettingsScopeType" ADD VALUE 'supplier';

-- AlterEnum
ALTER TYPE "StoreStatus" ADD VALUE 'orders_paused';

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_seller_id_fkey";

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "published_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "supplier_id" UUID,
ALTER COLUMN "seller_id" DROP NOT NULL;

-- Module 20 (FR-7.10 supplement) - exactly one of seller_id/supplier_id,
-- never both and never neither. Prisma has no schema-level support for a
-- CHECK constraint spanning two nullable columns, hand-added here - same
-- "Prisma manages columns, migration.sql hand-adds what it can't express"
-- pattern RLS policies already use throughout this project.
ALTER TABLE "subscriptions" ADD CONSTRAINT "chk_subscriptions_exactly_one_owner"
  CHECK (("seller_id" IS NOT NULL AND "supplier_id" IS NULL) OR ("seller_id" IS NULL AND "supplier_id" IS NOT NULL));

-- CreateTable
CREATE TABLE "wallet_topup_requests" (
    "id" UUID NOT NULL,
    "owner_type" "WalletOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "status" "TopUpRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ,
    "verified_by" UUID,

    CONSTRAINT "wallet_topup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_wallet_entries" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "type" "SupplierLedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_wallet_topups_owner_status" ON "wallet_topup_requests"("owner_type", "owner_id", "status");

-- CreateIndex
CREATE INDEX "idx_supplier_wallet_entries_supplier_created" ON "supplier_wallet_entries"("supplier_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_supplier_id_key" ON "subscriptions"("supplier_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topup_requests" ADD CONSTRAINT "wallet_topup_requests_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_wallet_entries" ADD CONSTRAINT "supplier_wallet_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
