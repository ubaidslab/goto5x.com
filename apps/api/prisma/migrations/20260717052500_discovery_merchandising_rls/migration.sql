-- Module 5 (Discovery & Merchandising): RLS on the new tenant tables, same
-- store_id-through-stores-subquery pattern proven since Module 2
-- (prisma/migrations/20260716104650_catalog_rls_and_drive_grants/migration.sql).
--
-- `collection_products` has `store_id` denormalized directly onto it (per
-- docs/database-schema.md's tenant-strategy note), same as `product_variants`
-- - the policy shape is identical regardless of whether store_id is the
-- table's own natural key or a denormalized convenience column.

ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collections" FORCE ROW LEVEL SECURITY;
CREATE POLICY collections_seller_isolation ON "collections"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "collection_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_products" FORCE ROW LEVEL SECURITY;
CREATE POLICY collection_products_seller_isolation ON "collection_products"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );

ALTER TABLE "store_navigation_menus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_navigation_menus" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_navigation_menus_seller_isolation ON "store_navigation_menus"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );
