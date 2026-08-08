-- Module 52 (SRS §5.59/FR-59.1) - a per-store sequential, human-readable
-- Order.orderNumber, plus the per-store counter (Store.nextOrderNumber) that
-- assigns each new order's number atomically at creation time.

-- AddColumn (nullable first - can't add a NOT NULL column with no default
-- to a table that already has rows, same two-step pattern this codebase has
-- used for every other backfilled column).
ALTER TABLE "orders" ADD COLUMN "order_number" INTEGER;

-- Backfill: one sequential number per store, ordered by placed_at (ties
-- broken by id for determinism) - FR-59.1's exact spec ("backfilled for
-- existing orders by placedAt order per store").
UPDATE "orders" o
SET "order_number" = numbered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY placed_at ASC, id ASC) AS rn
  FROM "orders"
) numbered
WHERE o.id = numbered.id;

ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uniq_orders_store_order_number" ON "orders"("store_id", "order_number");

-- AddColumn - the per-store atomic counter. A plain `UPDATE ... SET
-- next_order_number = next_order_number + 1` is Postgres's own row-lock
-- serialization at work: two concurrent checkouts against the same store
-- can never be assigned the same number, with no application-level locking
-- needed (same reasoning as Module 46's atomic conditional-decrement stock
-- protection, applied here to an increment instead).
ALTER TABLE "stores" ADD COLUMN "next_order_number" INTEGER NOT NULL DEFAULT 1;

-- Seed each existing store's counter to one past its highest backfilled
-- order_number (1 for a store with no orders at all).
UPDATE "stores" s
SET "next_order_number" = COALESCE(
  (SELECT MAX(o."order_number") + 1 FROM "orders" o WHERE o."store_id" = s.id),
  1
);
