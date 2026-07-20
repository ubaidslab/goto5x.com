-- Module 20 (SRS v0.24 §5.6e, FR-6.25) - low-balance grace-ladder tracking
-- fields, added to `sellers` (the wallet's real owner) rather than `stores`.
-- The `idx_products_search`/`products.search_vector` lines this diff would
-- otherwise include are the same known false positive noted in the
-- previous migration - stripped again here.

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "wallet_grace_period_ends_at" TIMESTAMPTZ,
ADD COLUMN     "wallet_low_balance_warning_sent_at" TIMESTAMPTZ;
