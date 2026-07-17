-- Module 6 (Listing Moderation Engine): moderation status on products,
-- trusted-seller flag, and the REVIEWER admin sub-role.

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'reviewer';

-- AlterTable
ALTER TABLE "products" ADD COLUMN "moderation_notes" TEXT,
ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'not_required';

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN "is_trusted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_products_moderation_status" ON "products"("moderation_status");
