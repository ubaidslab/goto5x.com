-- Module 10 (Seller Dashboard UI) rollout: image management UI needs
-- reorder + set-primary support on media_assets.

ALTER TABLE "media_assets" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "media_assets" ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;
