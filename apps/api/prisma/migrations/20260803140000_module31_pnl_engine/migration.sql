-- Module 31 (SRS §5.42/FR-42.1-42.7) - Automated Profit & Loss Engine.
-- Reuses existing revenue/commission/discount data (Order, LedgerEntry);
-- adds only the cost inputs that don't exist anywhere yet.

-- Per-variant base cost (COGS) - optional, flagged when missing rather
-- than silently treated as zero (FR-42.1/42.2).
ALTER TABLE "product_variants" ADD COLUMN "base_cost" DECIMAL(12,2);

-- Optional per-order courier/handling costs (FR-42.1) - unlike base cost,
-- a missing value here is genuinely zero (not every order has one), so no
-- flagging is needed for these two.
ALTER TABLE "orders" ADD COLUMN "courier_cost" DECIMAL(12,2);
ALTER TABLE "orders" ADD COLUMN "handling_cost" DECIMAL(12,2);

-- Ad-spend entries, scoped to a date period (FR-42.1/42.3). `source` is a
-- documented extension seam (FR-42.6) - a future automated Facebook/TikTok
-- Ads API sync would write rows with a new source value through the same
-- table/period-aggregation logic, never a parallel one.
CREATE TYPE "AdSpendSource" AS ENUM ('manual', 'csv_import');

CREATE TABLE "ad_spend_entries" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source" "AdSpendSource" NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_spend_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_ad_spend_store_period" ON "ad_spend_entries"("store_id", "period_start", "period_end");

ALTER TABLE "ad_spend_entries" ADD CONSTRAINT "ad_spend_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same store_id-through-stores-subquery pattern proven since Module 2
-- (FR-42.5).
ALTER TABLE "ad_spend_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_spend_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY ad_spend_entries_seller_isolation ON "ad_spend_entries"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
