-- Module 59 (SRS §5.6g, FR-6.33) - Combined Entry-Flow Payment
-- Extends the existing wallet_topup_requests table with the plan-fee
-- portion of a combined signup payment. Nullable and additive only -
-- every pre-existing top-up request (and every ordinary top-up going
-- forward) has NULL here and is completely unaffected.

ALTER TABLE "wallet_topup_requests" ADD COLUMN "plan_fee_portion" DECIMAL(12, 2);
