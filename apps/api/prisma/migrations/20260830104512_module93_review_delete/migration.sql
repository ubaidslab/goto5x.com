-- Module 93 (SRS §5.14/FR-14.5-14.6) - review detail view (read-only, no
-- schema change) and reason-audited soft-delete. Adds a "deleted" value to
-- ReviewStatus and deleted_at/deleted_reason columns on product_reviews.
--
-- Note: `prisma migrate diff` spuriously proposes dropping/re-adding the
-- og_image_media_id FKs on collections/products, dropping several
-- indexes, altering low_stock_alert_sent_at's type, dropping
-- search_vector's default, and renaming several pre-existing unique
-- indexes - the same known false positive with generated tsvector columns
-- + prisma's diff engine this repo has hit on every prior migration.
-- Stripped here, not applied - only the two real changes below.

-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'deleted';

-- AlterTable
ALTER TABLE "product_reviews" ADD COLUMN "deleted_at" TIMESTAMPTZ,
ADD COLUMN "deleted_reason" TEXT;
