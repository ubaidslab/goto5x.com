-- Module 92 (SRS §5.68/FR-68.2-68.3) - admin-configurable, lockable brand
-- color tokens. Adds a "color" Settings Registry value type and a general
-- "locked" flag on settings_values (rejects further writes to that row
-- until explicitly unlocked - see SettingsService.setValue()).
--
-- Note: `prisma migrate diff` spuriously proposes dropping/re-adding the
-- og_image_media_id FKs on collections/products, dropping several
-- indexes, altering low_stock_alert_sent_at's type, dropping
-- search_vector's default, and renaming several pre-existing unique
-- indexes - the same known false positive with generated tsvector columns
-- + prisma's diff engine this repo has hit on every prior migration.
-- Stripped here, not applied - only the two real changes below.

-- AlterEnum
ALTER TYPE "SettingsValueType" ADD VALUE 'color';

-- AlterTable
ALTER TABLE "settings_values" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;
