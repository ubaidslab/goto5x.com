-- Phase 3 item 17 (SRS FR-8.22, extends FR-8.15/FR-8.7) - closes the 4
-- confirmed gaps in the existing PlatformMessage system: image field,
-- shown-count-limit trigger, persistent per-account shown-count tracking
-- (replacing the old sessionStorage-only popup dismissal), and supplier
-- targeting/delivery.

-- AlterEnum
ALTER TYPE "PlatformMessageTargetType" ADD VALUE 'supplier';

-- AlterTable
ALTER TABLE "platform_messages" ADD COLUMN     "target_supplier_id" UUID,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "max_shown_count" INTEGER;

-- DropIndex
DROP INDEX "idx_messages_targeting";

-- CreateIndex
CREATE INDEX "idx_messages_targeting" ON "platform_messages"("target_type", "target_plan_id", "target_seller_id", "target_supplier_id");

-- CreateTable
CREATE TABLE "platform_message_views" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "seller_id" UUID,
    "supplier_id" UUID,
    "shown_count" INTEGER NOT NULL DEFAULT 0,
    "last_shown_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_message_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_message_view_seller" ON "platform_message_views"("message_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_message_view_supplier" ON "platform_message_views"("message_id", "supplier_id");

-- AddForeignKey
ALTER TABLE "platform_message_views" ADD CONSTRAINT "platform_message_views_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "platform_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Module 20 (FR-7.10 supplement) established this pattern for Subscription -
-- exactly one of seller_id/supplier_id, never both and never neither.
-- Prisma has no schema-level support for a CHECK constraint spanning two
-- nullable columns, hand-added here - same "Prisma manages columns,
-- migration.sql hand-adds what it can't express" pattern RLS policies
-- already use throughout this project.
ALTER TABLE "platform_message_views" ADD CONSTRAINT "chk_message_views_exactly_one_viewer"
  CHECK (("seller_id" IS NOT NULL AND "supplier_id" IS NULL) OR ("seller_id" IS NULL AND "supplier_id" IS NOT NULL));
