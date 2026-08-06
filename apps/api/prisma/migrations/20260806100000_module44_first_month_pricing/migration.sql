-- Module 44 (SRS v0.33 FR-7.19) - struck-through "regular" price alongside
-- the existing `price` column. Nullable: a plan with no regular/discounted
-- distinction simply has none.
ALTER TABLE "plans" ADD COLUMN "regular_price" DECIMAL(12,2);
