-- Security-checklist audit finding (docs/security-audit-report.md Phase 6,
-- item 3): these foreign-key columns had no index at all, forcing a full
-- table scan for any query filtering on them. Purely additive, no data or
-- behavior change.
CREATE INDEX "idx_domains_store_id" ON "domains"("store_id");
CREATE INDEX "idx_ledger_order_id" ON "ledger_entries"("order_id");
CREATE INDEX "idx_ledger_invoice_id" ON "ledger_entries"("invoice_id");
CREATE INDEX "idx_media_thumbnail_media_id" ON "media_assets"("thumbnail_media_id");
CREATE INDEX "idx_deals_thumbnail_media_id" ON "deals"("thumbnail_media_id");
