-- Module 61 (SRS §5.7, FR-7.20) - Four-Tier Plan Pricing Model.
-- Adds the per-tier first-cycle discount and campaign-price fields, a
-- six_month billing cycle, and the subscription-level cycle field that
-- drives which multiplier a renewal applies. All additive/nullable-or-
-- defaulted - no existing row changes meaning.

ALTER TYPE "PlanBillingInterval" ADD VALUE 'six_month';

ALTER TABLE "plans" ADD COLUMN "first_cycle_price" DECIMAL(12, 2);
ALTER TABLE "plans" ADD COLUMN "campaign_price" DECIMAL(12, 2);
ALTER TABLE "plans" ADD COLUMN "campaign_active" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "subscriptions" ADD COLUMN "billing_interval" "PlanBillingInterval" NOT NULL DEFAULT 'monthly';
