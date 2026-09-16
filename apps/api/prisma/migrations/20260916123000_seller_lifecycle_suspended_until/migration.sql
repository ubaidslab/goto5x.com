-- Founder walkthrough finding (Phase 2 item 16) - a set/lifted suspension
-- can now carry an auto-lift date instead of always being indefinite.

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "lifecycle_suspended_until" TIMESTAMPTZ;
