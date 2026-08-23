-- Module 66 (SRS §5.6k, FR-6.43) - stages the seller's store-choice
-- confirmation from a downgrade request alongside pending_plan_id, applied
-- by the same scheduled cycle job.
ALTER TABLE "subscriptions" ADD COLUMN "pending_keep_store_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
