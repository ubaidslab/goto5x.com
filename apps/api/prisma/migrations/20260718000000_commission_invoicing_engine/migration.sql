-- Module 11 (Commission & Invoicing Engine, SRS §5.6c) plus the
-- store_payment_instructions prerequisite fix (FR-6.14, specified in v0.15,
-- never actually built until now - see docs/build-plan.md's flagged gap).
--
-- `prisma migrate diff` also proposed the same known-false-positive
-- `DROP INDEX "idx_products_search"` / `ALTER TABLE "products" ALTER COLUMN
-- "search_vector" DROP DEFAULT` lines against the Module 5 generated column
-- (same issue documented in the Module 9 migration's own header comment),
-- stripped from this file.

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('sale_credit', 'commission_debit', 'gateway_fee_debit', 'hold_release', 'reserve_hold', 'reserve_release', 'payout_debit', 'refund_adjustment', 'commission_accrued', 'commission_waived');

-- CreateEnum
CREATE TYPE "BalanceBucket" AS ENUM ('pending', 'available', 'reserved');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid', 'overdue');

-- CreateTable
CREATE TABLE "store_payment_instructions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "bank_account_title" TEXT,
    "bank_account_number" TEXT,
    "bank_name" TEXT,
    "jazzcash_number" TEXT,
    "easypaisa_number" TEXT,
    "cod_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_payment_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "order_id" UUID,
    "invoice_id" UUID,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "balance_bucket" "BalanceBucket",
    "hold_release_at" TIMESTAMPTZ,
    "reserve_release_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_invoices" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMPTZ NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "paid_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_payment_instructions_store_id_key" ON "store_payment_instructions"("store_id");

-- CreateIndex
CREATE INDEX "idx_ledger_seller_created" ON "ledger_entries"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_seller_invoices_seller_status" ON "seller_invoices"("seller_id", "status");

-- CreateIndex
CREATE INDEX "idx_seller_invoices_overdue_check" ON "seller_invoices"("status", "due_date");

-- AddForeignKey
ALTER TABLE "store_payment_instructions" ADD CONSTRAINT "store_payment_instructions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "seller_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_invoices" ADD CONSTRAINT "seller_invoices_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_invoices" ADD CONSTRAINT "seller_invoices_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: store_payment_instructions is store-scoped, same store_id-through-
-- stores-subquery pattern as store_shipping_settings/store_tax_settings
-- (prisma/migrations/20260717080000_shipping_tax_discounts/migration.sql).
ALTER TABLE "store_payment_instructions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_payment_instructions" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_payment_instructions_seller_isolation ON "store_payment_instructions"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

-- RLS: ledger_entries and seller_invoices are seller-scoped directly (they
-- already carry seller_id), so the policy is a direct comparison rather
-- than a stores subquery.
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY ledger_entries_seller_isolation ON "ledger_entries"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);

ALTER TABLE "seller_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seller_invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY seller_invoices_seller_isolation ON "seller_invoices"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);
