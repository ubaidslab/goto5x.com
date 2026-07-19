-- Module 15.5 (FR-32.5): store logo upload.
--
-- Note: `prisma migrate diff` spuriously proposes dropping "idx_products_search"
-- and the search_vector column default. This is a known false positive (Prisma's
-- diff engine does not understand the GENERATED ALWAYS AS search_vector column
-- from Module 5) and both lines have been stripped from this migration.

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "logo_media_id" UUID;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

