-- Module 53 (SRS §5.60/FR-60.1) - Returns & Refunds Workflow. Promotes and
-- completes the `return_requests` table docs/database-schema.md already
-- reserved (v1.1-ahead, formerly FR-22.3), extended with the partial-refund
-- fields the founder's Module 53 spec adds.

CREATE TYPE "ReturnRequestStatus" AS ENUM ('requested', 'approved', 'rejected', 'completed');

CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "buyer_reason" TEXT NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'requested',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_type" TEXT,
    "resolved_by_user_id" UUID,
    "refund_amount" DECIMAL(12,2),
    "refunded_items" JSONB,
    "seller_note" TEXT,
    "admin_override" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_return_requests_store_status" ON "return_requests"("store_id", "status");
CREATE INDEX "idx_return_requests_order" ON "return_requests"("order_id");

ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same store_id-through-stores-subquery pattern proven since Module 2.
ALTER TABLE "return_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "return_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY return_requests_seller_isolation ON "return_requests"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
