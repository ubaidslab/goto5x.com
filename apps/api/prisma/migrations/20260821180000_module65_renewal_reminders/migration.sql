-- Module 65 (SRS §5.6k, FR-6.42) - the pre-expiry reminder ladder's sticky
-- sent-at timestamps (per subscription-cycle, cleared on every renewal by
-- WalletService.verifyTopUp()) and the win-back ladder's (per
-- terminalPausedAt episode, cleared by restoreAfterPlanFeePayment()
-- alongside Module 64's own retention_warning_day0/7/13_sent_at columns).
ALTER TABLE "subscriptions" ADD COLUMN "renewal_reminder_day7_sent_at" TIMESTAMPTZ;
ALTER TABLE "subscriptions" ADD COLUMN "renewal_reminder_day3_sent_at" TIMESTAMPTZ;
ALTER TABLE "subscriptions" ADD COLUMN "renewal_reminder_day1_sent_at" TIMESTAMPTZ;
ALTER TABLE "subscriptions" ADD COLUMN "renewal_reminder_expiry_day_sent_at" TIMESTAMPTZ;

ALTER TABLE "stores" ADD COLUMN "winback_day3_sent_at" TIMESTAMPTZ;
ALTER TABLE "stores" ADD COLUMN "winback_day7_sent_at" TIMESTAMPTZ;
ALTER TABLE "stores" ADD COLUMN "winback_day14_sent_at" TIMESTAMPTZ;
