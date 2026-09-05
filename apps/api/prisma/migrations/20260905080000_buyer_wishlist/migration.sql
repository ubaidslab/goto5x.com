-- FR-66.5 (Module 85, v0.58) - wishlist/save-for-later, account-gated
-- (mirrors buyer_saved_addresses - global buyer identity, no RLS/seller
-- context, same as the rest of the buyer-account tables).

-- CreateTable
CREATE TABLE "buyer_wishlist_items" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_buyer_wishlist_buyer" ON "buyer_wishlist_items"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_wishlist_items_buyer_id_product_id_key" ON "buyer_wishlist_items"("buyer_id", "product_id");

-- AddForeignKey
ALTER TABLE "buyer_wishlist_items" ADD CONSTRAINT "buyer_wishlist_items_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_wishlist_items" ADD CONSTRAINT "buyer_wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
