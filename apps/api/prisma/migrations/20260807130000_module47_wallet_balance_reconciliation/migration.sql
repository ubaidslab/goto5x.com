-- Module 47 (SRS v0.33 §5.6e, FR-6.21 amended, new FR-6.29) - the seller
-- wallet balance becomes a maintained running-total cache column instead of
-- a re-aggregated-on-every-read SUM over ledger_entries. ledger_entries
-- stays the append-only source of truth; wallet_balances is its verified
-- cache, kept in sync ONLY via WalletService.postLedgerEntry() (application
-- code), which always writes both rows in the same DB transaction.

-- CreateTable
CREATE TABLE "wallet_balances" (
    "seller_id" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallet_balances_pkey" PRIMARY KEY ("seller_id")
);

-- CreateTable
CREATE TABLE "wallet_reconciliation_drifts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "cached_balance" DECIMAL(12,2) NOT NULL,
    "ledger_balance" DECIMAL(12,2) NOT NULL,
    "drift_amount" DECIMAL(12,2) NOT NULL,
    "detected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_reconciliation_drifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_reconciliation_drifts_detected_at_idx" ON "wallet_reconciliation_drifts"("detected_at");

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_reconciliation_drifts" ADD CONSTRAINT "wallet_reconciliation_drifts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: both tables are seller-scoped directly (they already carry
-- seller_id), same direct-comparison pattern as ledger_entries/
-- seller_invoices (prisma/migrations/20260718000000_commission_invoicing_engine/migration.sql).
ALTER TABLE "wallet_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_balances" FORCE ROW LEVEL SECURITY;
CREATE POLICY wallet_balances_seller_isolation ON "wallet_balances"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);

ALTER TABLE "wallet_reconciliation_drifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_reconciliation_drifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY wallet_reconciliation_drifts_seller_isolation ON "wallet_reconciliation_drifts"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);

-- Backfill: one wallet_balances row per existing seller, computed from
-- ledger_entries using the EXACT same type -> +/- mapping as
-- WalletService's signedContribution() (billing/wallet.service.ts) - every
-- credit type adds, every debit type subtracts, commission_waived's
-- already-negative amount adds back, every other (dormant §5.6c/§5.6) type
-- contributes 0. A seller with zero ledger_entries still gets a row, at 0.
INSERT INTO "wallet_balances" ("seller_id", "balance", "updated_at")
SELECT
  s.id,
  COALESCE(SUM(
    CASE
      WHEN le.type IN ('wallet_topup_credit', 'program_commission_credit', 'program_reward_credit', 'verification_fee_refund_credit', 'admin_manual_credit')
        THEN le.amount
      WHEN le.type = 'commission_waived'
        THEN -le.amount
      WHEN le.type IN ('commission_accrued', 'wallet_plan_fee_debit', 'wallet_team_seat_fee_debit', 'wallet_device_slot_fee_debit', 'payout_debit', 'program_clawback_debit', 'verification_fee_debit', 'admin_manual_debit')
        THEN -le.amount
      ELSE 0
    END
  ), 0),
  CURRENT_TIMESTAMP
FROM "sellers" s
LEFT JOIN "ledger_entries" le ON le.seller_id = s.id
GROUP BY s.id;

-- Verify: recompute the same ledger sum independently and hard-fail the
-- migration (rolling back everything above) if even one seller's freshly-
-- backfilled wallet_balances.balance doesn't exactly match it. The cached
-- column is never considered "live" if this doesn't pass.
DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM "wallet_balances" wb
  JOIN (
    SELECT
      s.id AS seller_id,
      COALESCE(SUM(
        CASE
          WHEN le.type IN ('wallet_topup_credit', 'program_commission_credit', 'program_reward_credit', 'verification_fee_refund_credit', 'admin_manual_credit')
            THEN le.amount
          WHEN le.type = 'commission_waived'
            THEN -le.amount
          WHEN le.type IN ('commission_accrued', 'wallet_plan_fee_debit', 'wallet_team_seat_fee_debit', 'wallet_device_slot_fee_debit', 'payout_debit', 'program_clawback_debit', 'verification_fee_debit', 'admin_manual_debit')
            THEN -le.amount
          ELSE 0
        END
      ), 0) AS computed_balance
    FROM "sellers" s
    LEFT JOIN "ledger_entries" le ON le.seller_id = s.id
    GROUP BY s.id
  ) computed ON computed.seller_id = wb.seller_id
  WHERE wb.balance != computed.computed_balance;

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'wallet_balances backfill verification failed: % seller(s) have a cached balance that does not match their independently recomputed ledger sum - refusing to bring the cached column live', mismatch_count;
  END IF;
END $$;
