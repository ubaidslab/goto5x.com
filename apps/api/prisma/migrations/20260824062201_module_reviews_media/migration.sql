-- Phase 4 close-out - review media (photos/video) attachments.
-- Note: `prisma migrate dev`'s auto-diff against this dev database also
-- proposed a handful of unrelated statements (index renames, an
-- og_image_media_id FK drop/recreate, a low_stock_alert_sent_at type
-- tweak, a search_vector default drop) reflecting pre-existing drift
-- between schema.prisma and this database's actual migration history,
-- not anything introduced by this change - deliberately excluded here so
-- this migration does exactly one thing.

-- CreateTable
CREATE TABLE "review_media" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_review_media_review" ON "review_media"("review_id");

-- AddForeignKey
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "product_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS - same one-hop-via-stores tenant-isolation shape every other table
-- here uses (see product_reviews_seller_isolation, the direct precedent).
ALTER TABLE "review_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY review_media_seller_isolation ON "review_media"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
