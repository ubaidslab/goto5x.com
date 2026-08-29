-- Known Prisma diff-engine false positive (documented in every prior
-- migration in this repo): a fresh diff against this schema always
-- includes spurious drops/recreates of the og_image_media_id FKs,
-- idx_products_search/idx_products_tags/idx_order_verifications_store_id,
-- the products.search_vector default, an unrelated column type coercion,
-- and RenameIndex noise for indexes whose Prisma-inferred name differs
-- from the DB's actual name. None of that reflects an intended change
-- here - only carts.deal_id below is real (Module 91, SRS §5.67/FR-67.2 -
-- the buy-now flow tags the cart it pre-populates so CheckoutService can
-- apply the deal's live discount when that cart converts to an order).

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "deal_id" UUID;

-- CreateIndex
CREATE INDEX "idx_carts_deal" ON "carts"("deal_id");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
