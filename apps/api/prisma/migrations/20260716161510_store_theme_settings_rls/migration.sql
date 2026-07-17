-- Module 4 (Theme Engine & Storefront Rendering): RLS on `store_theme_settings`,
-- same store_id-through-stores-subquery pattern as Module 2/3's tenant tables
-- (prisma/migrations/20260716104650_catalog_rls_and_drive_grants/migration.sql).
--
-- `themes` is deliberately NOT row-level-secured, same reasoning as
-- `categories`/`plans` in that same migration's trailing comment: it's a
-- global, admin-managed catalog every seller reads identically. Writes to it
-- happen only through app_admin (BYPASSRLS).

ALTER TABLE "store_theme_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_theme_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_theme_settings_seller_isolation ON "store_theme_settings"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );
