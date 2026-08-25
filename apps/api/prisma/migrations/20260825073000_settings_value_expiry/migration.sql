-- D-Studio close-out (founder-requested time-limited feature grants).
-- Only this ALTER is included here - hand-written, not auto-diffed,
-- following this repo's established practice of excluding unrelated
-- pre-existing schema/DB drift from a migration that isn't about it.
ALTER TABLE "settings_values" ADD COLUMN "expires_at" TIMESTAMPTZ;
