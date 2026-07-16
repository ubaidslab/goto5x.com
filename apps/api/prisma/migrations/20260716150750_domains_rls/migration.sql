-- Module 3 (Custom Domain & TLS): RLS on `domains`, same store_id-through-
-- stores-subquery pattern as Module 2's tenant tables
-- (prisma/migrations/20260716104650_catalog_rls_and_drive_grants/migration.sql).

ALTER TABLE "domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "domains" FORCE ROW LEVEL SECURITY;
CREATE POLICY domains_seller_isolation ON "domains"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );
