-- Phase 5 (founder-requested "missing tracking" alert sweep) - hand-
-- written, containing only this change (this repo's established practice
-- for excluding unrelated pre-existing schema/DB drift from a migration).
ALTER TABLE "orders" ADD COLUMN "missing_tracking_alerted_at" TIMESTAMPTZ;
