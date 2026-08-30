-- Module 94 (SRS §5.69/FR-69.1) - product custom attributes: an ordered
-- array of {key, value} string pairs, buyer-facing, explicitly non-variant.
--
-- Note: `prisma migrate diff` spuriously proposes dropping/re-adding the
-- og_image_media_id FKs on collections/products, dropping several
-- indexes, altering low_stock_alert_sent_at's type, dropping
-- search_vector's default, and renaming several pre-existing unique
-- indexes - the same known false positive with generated tsvector columns
-- + prisma's diff engine this repo has hit on every prior migration.
-- Stripped here, not applied - only the real change below.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "custom_attributes" JSONB NOT NULL DEFAULT '[]';
