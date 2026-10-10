-- B1 (founder reply to D89/D59, Section B item 1) - single ACTIVE store per
-- seller, enforced at the database level, not only in
-- StoresService.create()'s check-then-act gate (which has a TOCTOU race
-- between two concurrent create() calls - both can pass the pre-check
-- before either commits). Cannot be expressed in schema.prisma's DSL (no
-- partial-index support), so it lives as raw SQL alongside the generated
-- migrations, same convention as 20260716094921_rls_and_audit_grants.
--
-- Partial, not a plain UNIQUE(seller_id): MultiStoreDowngradeService (D74)
-- already relies on a seller holding multiple non-active (orders_paused)
-- stores at once - reclaimable within its 30-day window, archived rather
-- than deleted. Only ever having more than one ACTIVE store at a time is
-- the actual rule this constraint enforces.

-- Idempotent data fix, run before the constraint that would otherwise
-- reject it on apply: any seller already holding 2+ active stores
-- (grandfathered from before this constraint existed) keeps their OLDEST
-- active store and has every other one paused - the exact same
-- status/timestamp MultiStoreDowngradeService.applyDowngrade() already
-- uses for an over-the-limit downgrade (oldest-kept-by-default, no
-- explicit seller choice), so these rows are indistinguishable from ones
-- that mechanism paused itself and remain eligible for its own
-- reclaim-on-upgrade window. Safe to run twice: once no seller has 2+
-- active rows, the WHERE rn > 1 set is empty.
WITH ranked AS (
  SELECT id, seller_id,
         row_number() OVER (PARTITION BY seller_id ORDER BY created_at ASC) AS rn
  FROM stores
  WHERE status = 'active'
)
UPDATE stores
SET status = 'orders_paused', over_limit_paused_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- IF NOT EXISTS makes this half idempotent too (the data fix above already
-- is); re-running the full migration.sql a second time is then a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS stores_one_active_per_seller
  ON stores (seller_id)
  WHERE status = 'active';
