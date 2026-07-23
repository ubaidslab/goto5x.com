-- Module 22 Phase A (SRS v0.26/§5.33, FR-33.1-33.12) - Growth & Partner
-- Programs' shared referral engine (Ambassador/Student Referral/Creators).
--
-- Two lines this diff would otherwise include are stripped as a known
-- false positive (see docs/build-plan.md's Module 5/theme-engine note on
-- `idx_products_search`/`products.search_vector`): Prisma's migration
-- diffing cannot represent the `GENERATED ALWAYS AS ... STORED` column
-- correctly and proposes to drop/recreate its index and default on every
-- unrelated migration. Not touched here - same as every migration since.

-- CreateEnum
CREATE TYPE "ReferralProgramType" AS ENUM ('ambassador', 'student_referral', 'creator');

-- CreateEnum
CREATE TYPE "ProgramParticipantStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'terminated');

-- CreateEnum
CREATE TYPE "ContentPlatform" AS ENUM ('tiktok', 'instagram', 'youtube', 'snapchat', 'facebook', 'x', 'pinterest');

-- CreateEnum
CREATE TYPE "ContentSubmissionStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "PayoutRequestStatus" AS ENUM ('requested', 'approved', 'processing', 'paid', 'rejected');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'program_commission_credit';
ALTER TYPE "LedgerEntryType" ADD VALUE 'program_reward_credit';
ALTER TYPE "LedgerEntryType" ADD VALUE 'program_clawback_debit';

-- CreateTable
CREATE TABLE "program_participants" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "program_type" "ReferralProgramType" NOT NULL,
    "status" "ProgramParticipantStatus" NOT NULL DEFAULT 'pending',
    "referral_code" TEXT,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ,
    "decided_by_admin_user_id" UUID,
    "decision_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "program_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_attributions" (
    "id" UUID NOT NULL,
    "referred_seller_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "program_type" "ReferralProgramType" NOT NULL,
    "commission_window_ends_at" TIMESTAMPTZ NOT NULL,
    "attributed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_content_submissions" (
    "id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "platform" "ContentPlatform" NOT NULL,
    "content_url" TEXT NOT NULL,
    "reported_views" INTEGER NOT NULL,
    "status" "ContentSubmissionStatus" NOT NULL DEFAULT 'pending',
    "reward_amount" DECIMAL(12,2),
    "verified_by_admin_user_id" UUID,
    "verified_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_content_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'requested',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_admin_user_id" UUID,
    "decided_at" TIMESTAMPTZ,
    "decision_notes" TEXT,
    "payment_reference" TEXT,
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_participants_referral_code_key" ON "program_participants"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "program_participants_seller_id_program_type_key" ON "program_participants"("seller_id", "program_type");

-- CreateIndex
CREATE UNIQUE INDEX "referral_attributions_referred_seller_id_key" ON "referral_attributions"("referred_seller_id");

-- CreateIndex
CREATE INDEX "idx_payout_requests_seller_status" ON "payout_requests"("seller_id", "status");

-- AddForeignKey
ALTER TABLE "program_participants" ADD CONSTRAINT "program_participants_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "program_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_seller_id_fkey" FOREIGN KEY ("referred_seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_content_submissions" ADD CONSTRAINT "program_content_submissions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "program_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
