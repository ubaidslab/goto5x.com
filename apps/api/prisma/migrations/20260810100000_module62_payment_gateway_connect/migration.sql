-- Module 62 (SRS §5.6h, FR-6.36) - Seller Payment Gateway Connect. A
-- seller's own connected Raast/Easypaisa/JazzCash/bank account; a buyer
-- paying through it auto-confirms the order (FR-6.38) rather than relying
-- on the manual mark-as-paid fallback. Credentials are AES-256-GCM
-- encrypted at rest at the application layer before this table ever sees
-- them (payment-gateway-credential-crypto.util.ts).

-- CreateEnum
CREATE TYPE "PaymentGatewayProvider" AS ENUM ('raast', 'easypaisa', 'jazzcash', 'bank');

-- CreateTable
CREATE TABLE "store_payment_gateway_connections" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "merchant_id" TEXT,
    "api_key_encrypted" TEXT,
    "api_secret_encrypted" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority_order" INTEGER NOT NULL DEFAULT 0,
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "store_payment_gateway_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_store_gateway_provider" ON "store_payment_gateway_connections"("store_id", "provider");

-- AddForeignKey
ALTER TABLE "store_payment_gateway_connections" ADD CONSTRAINT "store_payment_gateway_connections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: store-scoped, same store_id-through-stores-subquery pattern as
-- store_payment_instructions (prisma/migrations/20260718000000_commission_invoicing_engine/migration.sql).
ALTER TABLE "store_payment_gateway_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_payment_gateway_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_payment_gateway_connections_seller_isolation ON "store_payment_gateway_connections"
  USING (
    store_id IN (
      SELECT id FROM "stores"
      WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid
    )
  );
