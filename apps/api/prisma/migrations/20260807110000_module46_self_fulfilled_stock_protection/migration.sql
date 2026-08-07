-- Module 46 (SRS v0.33 FR-39.5 corrected) - checkout's atomic oversell-
-- protection decrement was wired only to supplier-fulfilled items; this
-- opt-out flag lets self-fulfilled checkout apply the same mechanism by
-- default (true) while still allowing a seller to mark a variant
-- untracked/unlimited-stock (false), same as today's behavior.
ALTER TABLE "product_variants" ADD COLUMN "track_inventory" BOOLEAN NOT NULL DEFAULT true;
