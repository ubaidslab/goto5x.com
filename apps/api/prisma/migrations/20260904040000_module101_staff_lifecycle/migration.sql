-- FR-52.14/FR-52.15 (Module 101, founder batch B14) - admin-initiated
-- staff-account lifecycle (suspend/block, reversible) and a reset-not-
-- reveal password-reset flow, mirroring User's own token-hash columns.

-- AlterEnum
ALTER TYPE "StaffAccountStatus" ADD VALUE 'suspended';
ALTER TYPE "StaffAccountStatus" ADD VALUE 'blocked';

-- AlterTable
ALTER TABLE "staff_accounts"
  ADD COLUMN "suspended_at" TIMESTAMPTZ,
  ADD COLUMN "suspended_until" TIMESTAMPTZ,
  ADD COLUMN "blocked_at" TIMESTAMPTZ,
  ADD COLUMN "password_reset_token_hash" TEXT,
  ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ;
