-- Module 37 (SRS §5.54/FR-54.1-54.6) - Advanced Granular Admin Control.
-- Four narrow, audit-logged admin controls, all reusing existing
-- mechanisms. This migration only needs one schema change: a new
-- `admin_removed` ModerationStatus value for FR-54.2's instant
-- single-product takedown (any prior status -> admin_removed). It is
-- deliberately never added to StorefrontService's PUBLIC_MODERATION_
-- STATUSES allowlist, so every existing storefront-visibility query
-- excludes it automatically with no other code change.

ALTER TYPE "ModerationStatus" ADD VALUE 'admin_removed';
