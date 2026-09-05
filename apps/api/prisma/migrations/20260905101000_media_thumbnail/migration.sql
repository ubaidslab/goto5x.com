-- FR-66.7 (Module 87, v0.58) - a seller-chosen poster image for a video
-- MediaAsset, same "seller-chosen, not auto-generated" pattern already
-- precedented by Deal.thumbnailMediaId (no video-frame-extraction infra
-- exists anywhere in this codebase).

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "thumbnail_media_id" UUID;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_thumbnail_media_id_fkey" FOREIGN KEY ("thumbnail_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
