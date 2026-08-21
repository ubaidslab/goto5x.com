-- Module 47 (SRS §5.47/FR-47.2, FR-47.3) - Milestone celebrations, the
-- first-order/threshold-crossing dashboard banner. Append-only table; the
-- unique index on (store_id, metric, threshold) is what guarantees "fires
-- exactly once per store per threshold" at the database level.
CREATE TYPE "MilestoneMetric" AS ENUM ('order_count', 'sales_amount');

CREATE TABLE "milestone_events" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "metric" "MilestoneMetric" NOT NULL,
    "threshold" DECIMAL(14,2) NOT NULL,
    "reached_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "milestone_events_store_id_metric_threshold_key" ON "milestone_events"("store_id", "metric", "threshold");

CREATE INDEX "idx_milestone_events_store_reached" ON "milestone_events"("store_id", "reached_at");

ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store_id-through-stores-subquery pattern proven since Module 2.
ALTER TABLE "milestone_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "milestone_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY milestone_events_seller_isolation ON "milestone_events"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

-- Immutable/append-only (FR-47.3, same discipline as PlatformEvent/
-- AdminAuditLog) - the runtime role may INSERT and SELECT, never UPDATE or
-- DELETE, enforced by revoking the privilege entirely rather than by
-- application-layer convention.
REVOKE UPDATE, DELETE ON "milestone_events" FROM app_runtime, app_admin;
