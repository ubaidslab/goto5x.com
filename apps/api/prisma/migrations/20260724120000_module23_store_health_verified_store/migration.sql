-- CreateEnum
CREATE TYPE "VerifiedStoreStatus" AS ENUM ('not_verified', 'pending_re_review', 'verified', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "VerifiedStoreApplicationStatus" AS ENUM ('pending_review', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'verification_fee_debit';
ALTER TYPE "LedgerEntryType" ADD VALUE 'verification_fee_refund_credit';

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "policy_text" TEXT,
ADD COLUMN     "re_review_flagged_at" TIMESTAMPTZ,
ADD COLUMN     "re_review_reason" TEXT,
ADD COLUMN     "verified_expires_at" TIMESTAMPTZ,
ADD COLUMN     "verified_since" TIMESTAMPTZ,
ADD COLUMN     "verified_status" "VerifiedStoreStatus" NOT NULL DEFAULT 'not_verified';

-- CreateTable
CREATE TABLE "store_health_score_history" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_health_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_store_applications" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "VerifiedStoreApplicationStatus" NOT NULL DEFAULT 'pending_review',
    "fee_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "eligibility_snapshot" JSONB NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ,
    "decision_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_store_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_store_health_history_store_computed" ON "store_health_score_history"("store_id", "computed_at");

-- CreateIndex
CREATE INDEX "idx_verified_store_app_status_created" ON "verified_store_applications"("status", "created_at");

-- AddForeignKey
ALTER TABLE "store_health_score_history" ADD CONSTRAINT "store_health_score_history_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_store_applications" ADD CONSTRAINT "verified_store_applications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_store_applications" ADD CONSTRAINT "verified_store_applications_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_store_applications" ADD CONSTRAINT "verified_store_applications_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: store_id-through-stores-subquery pattern proven since Module 2 -
-- both new tables carry a real store_id (tenant data), unlike Module 22's
-- seller-scoped tables (ProgramParticipant etc.), which deliberately have
-- no RLS policy of their own (accessed via PrismaAdminService + explicit
-- sellerId filtering instead, same as Seller/Subscription/LedgerEntry).
ALTER TABLE "store_health_score_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_health_score_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY store_health_score_history_seller_isolation ON "store_health_score_history"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));

ALTER TABLE "verified_store_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verified_store_applications" FORCE ROW LEVEL SECURITY;
CREATE POLICY verified_store_applications_seller_isolation ON "verified_store_applications"
  USING (store_id IN (SELECT id FROM "stores" WHERE seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid));
