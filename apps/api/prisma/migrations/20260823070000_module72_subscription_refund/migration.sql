-- Module 72 (SRS §5.6k, FR-6.49) - the one-time first-cycle cancellation
-- refund's idempotency marker.
ALTER TABLE "subscriptions" ADD COLUMN "first_cycle_refunded_at" TIMESTAMPTZ;
