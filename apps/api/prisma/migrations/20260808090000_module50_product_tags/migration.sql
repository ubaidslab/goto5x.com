-- Module 50 (SRS §5.57/FR-57.1) - free-form seller-defined product tags,
-- dashboard-private by default (FR-57.4). GIN index since a text[] column
-- needs one for any future array-overlap ("&&") filter to perform at
-- scale (today's dashboard tag filter, and any later storefront opt-in) -
-- same reasoning as idx_products_search's own GIN index, hand-written here
-- for the same reason: Prisma's `@@index` can't declare an index type
-- without the extendedIndexes preview feature, which this schema doesn't
-- otherwise need.

ALTER TABLE "products" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "idx_products_tags" ON "products" USING GIN ("tags");
