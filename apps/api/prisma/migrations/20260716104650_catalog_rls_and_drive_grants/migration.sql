-- Module 2 (Catalog & Media): RLS on the new tenant tables, following the
-- exact pattern proven on `stores` in Module 1
-- (prisma/migrations/20260716094921_rls_and_audit_grants/migration.sql):
-- fail-closed (no session variable set => zero rows, not an error and not
-- "all rows"), via nullif(current_setting(...), '')::uuid rather than a bare
-- cast, because a custom GUC that has been SET LOCAL at all in a session
-- returns '' (not NULL) once the transaction ends, and a bare ::uuid cast on
-- '' throws instead of comparing false.
--
-- products/product_variants/media_assets are keyed by store_id, not
-- seller_id directly, so their policies resolve ownership through `stores`
-- (which is itself RLS-protected under the same rule for app_runtime,
-- non-BYPASSRLS role - the subquery is evaluated under the same policy, so
-- it naturally only ever sees the calling seller's own stores).

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY products_seller_isolation ON "products"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY product_variants_seller_isolation ON "product_variants"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY media_assets_seller_isolation ON "media_assets"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

-- google_drive_connections is seller-scoped directly (one Google account per
-- seller, not per store) - same predicate shape as the `stores` policy itself.
ALTER TABLE "google_drive_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_drive_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY drive_connections_seller_isolation ON "google_drive_connections"
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);

-- `categories` is a global, admin-managed taxonomy (SRS docs/database-schema.md)
-- - deliberately NOT row-level-secured; every seller reads the same catalog.
-- Writes happen only through app_admin (BYPASSRLS), matching `plans`/`themes`.
