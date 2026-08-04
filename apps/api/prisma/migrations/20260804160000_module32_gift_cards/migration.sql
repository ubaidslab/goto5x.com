-- Module 32 (SRS §5.49/FR-49.1-49.7) - Gift Cards. Mirrors DiscountCode's
-- store-scoped unique-code shape plus a wallet-ledger-style
-- atomically-guarded balance.

CREATE TYPE "GiftCardSource" AS ENUM ('buyer_purchase', 'seller_issued');
CREATE TYPE "GiftCardStatus" AS ENUM ('pending_payment', 'active', 'depleted', 'expired', 'cancelled');

CREATE TABLE "gift_cards" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "source" "GiftCardSource" NOT NULL,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'pending_payment',
    "initial_value" DECIMAL(12,2) NOT NULL,
    "remaining_balance" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "purchaser_email" TEXT,
    "issued_note" TEXT,
    "expires_at" TIMESTAMPTZ,
    "activated_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_gift_card_store" ON "gift_cards"("store_id", "code");
CREATE INDEX "idx_gift_cards_store_status" ON "gift_cards"("store_id", "status");

ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order gains a payment-reduction field, distinct from discount_amount
-- (FR-49.5) - never touches computeOrderTotals()'s tax/shipping math.
ALTER TABLE "orders" ADD COLUMN "gift_card_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "gift_card_redemptions" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "gift_card_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_gift_card_redemptions_gift_card" ON "gift_card_redemptions"("gift_card_id");
CREATE INDEX "idx_gift_card_redemptions_order" ON "gift_card_redemptions"("order_id");

ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same store_id-through-stores-subquery pattern proven since Module 2
-- (FR-49.7). gift_card_redemptions denormalizes store_id purely for this
-- same policy pattern (never queried by it directly - always reached via
-- gift_card_id/order_id), same discipline as OrderItem/ProductReview etc.
ALTER TABLE "gift_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gift_cards" FORCE ROW LEVEL SECURITY;
CREATE POLICY gift_cards_seller_isolation ON "gift_cards"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "gift_card_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gift_card_redemptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY gift_card_redemptions_seller_isolation ON "gift_card_redemptions"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
