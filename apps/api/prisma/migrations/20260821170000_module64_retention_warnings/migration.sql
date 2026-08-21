-- Module 64 (SRS §5.6k, FR-6.41) - per-milestone warning-sent timestamps
-- for the 14-day retention window.
ALTER TABLE "stores" ADD COLUMN "retention_warning_day0_sent_at" TIMESTAMPTZ;
ALTER TABLE "stores" ADD COLUMN "retention_warning_day7_sent_at" TIMESTAMPTZ;
ALTER TABLE "stores" ADD COLUMN "retention_warning_day13_sent_at" TIMESTAMPTZ;
