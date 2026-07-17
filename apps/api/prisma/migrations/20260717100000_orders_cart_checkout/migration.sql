-- Module 9 (Orders, Cart & Checkout): carts, orders, order_items,
-- order_notes, order_timeline_events, tracking_updates, payments.
-- Hand-written - `prisma migrate diff` proposed the same corrective
-- `DROP INDEX "idx_products_search"` / `ALTER TABLE "products" ALTER
-- COLUMN "search_vector" DROP DEFAULT` lines against the Module 5
-- generated column (same known issue, see docs/build-plan.md's Module 5
-- section), stripped from this file.
--
-- ledger_entries is deliberately NOT part of this migration - it is
-- Module 10/11's (Payments & Ledger) own table, per docs/build-plan.md's
-- stated module boundary. Manual orders in this module produce a
-- `payments` row only; the ledger-entry checklist items in SRS §14.17
-- are a disclosed forward dependency on that module, not built here.

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('active', 'abandoned', 'converted', 'expired');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('storefront', 'manual');

-- CreateEnum
CREATE TYPE "OrderItemFulfillmentStatus" AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'completed');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('safepay', 'cod', 'payfast', 'jazzcash', 'easypaisa', 'stripe', 'manual');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "status" "CartStatus" NOT NULL DEFAULT 'active',
    "converted_order_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "buyer_id" UUID,
    "buyer_email" TEXT NOT NULL,
    "status_lookup_token" TEXT NOT NULL,
    "shipping_address" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "source" "OrderSource" NOT NULL DEFAULT 'storefront',
    "discount_code_id" UUID,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shipping_amount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "supplier_id" UUID,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "shipping_cost" DECIMAL(12,2) NOT NULL,
    "fulfillment_status" "OrderItemFulfillmentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_timeline_events" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_updates" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "carrier" TEXT,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "gateway_transaction_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "raw_webhook_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_session_token_key" ON "carts"("session_token");

-- CreateIndex
CREATE INDEX "idx_carts_store_status_updated" ON "carts"("store_id", "status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_status_lookup_token_key" ON "orders"("status_lookup_token");

-- CreateIndex
CREATE INDEX "idx_orders_store_status_date" ON "orders"("store_id", "status", "placed_at");

-- CreateIndex
CREATE INDEX "idx_orders_discount_code" ON "orders"("discount_code_id");

-- CreateIndex
CREATE INDEX "idx_order_items_supplier_status" ON "order_items"("supplier_id", "fulfillment_status", "created_at");

-- CreateIndex
CREATE INDEX "idx_order_items_order_id" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "idx_order_notes_order" ON "order_notes"("order_id");

-- CreateIndex
CREATE INDEX "idx_order_timeline_order_created" ON "order_timeline_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_tracking_order_item" ON "tracking_updates"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_transaction_id_key" ON "payments"("gateway_transaction_id");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_timeline_events" ADD CONSTRAINT "order_timeline_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_updates" ADD CONSTRAINT "tracking_updates_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store_id-through-stores-subquery pattern proven since Module 2.
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carts" FORCE ROW LEVEL SECURITY;
CREATE POLICY carts_seller_isolation ON "carts"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY orders_seller_isolation ON "orders"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_items_seller_isolation ON "order_items"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "order_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_notes_seller_isolation ON "order_notes"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "order_timeline_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_timeline_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_timeline_events_seller_isolation ON "order_timeline_events"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "tracking_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracking_updates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tracking_updates_seller_isolation ON "tracking_updates"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_seller_isolation ON "payments"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
