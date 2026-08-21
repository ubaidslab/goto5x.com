-- FR-8.16 (v0.40) - data-driven high-impact-key detection for the admin
-- confirmation-dialog mechanism, replacing the prior hardcoded frontend
-- string-match (billing./commission/platform.maintenance).
ALTER TABLE "settings_definitions" ADD COLUMN "requires_confirmation" BOOLEAN NOT NULL DEFAULT false;
