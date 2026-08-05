-- Module 33 (SRS §5.50/FR-50.1-50.6) - Customer Segments. A saved filter,
-- never a materialized member list - membership is always resolved live
-- against customers.orders_count/total_spent/last_order_at (already
-- tracked since Module 15).

CREATE TABLE "customer_segments" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_orders" INTEGER,
    "max_orders" INTEGER,
    "min_total_spent" DECIMAL(12,2),
    "max_total_spent" DECIMAL(12,2),
    "last_order_after" TIMESTAMPTZ,
    "last_order_before" TIMESTAMPTZ,
    "location_city" TEXT,
    "location_country" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_customer_segments_store" ON "customer_segments"("store_id");

ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same store_id-through-stores-subquery pattern proven since Module 2
-- (FR-50.5).
ALTER TABLE "customer_segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_segments" FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_segments_seller_isolation ON "customer_segments"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
