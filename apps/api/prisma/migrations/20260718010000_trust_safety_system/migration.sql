-- Module 12: Trust & Safety System (SRS §5.29/§5.30).
--
-- Note: `prisma migrate diff` also proposed `DROP INDEX "idx_products_search"`
-- and `ALTER TABLE "products" ALTER COLUMN "search_vector" DROP DEFAULT` -
-- the same known Module 5 generated-column false-positive seen in every
-- prior hand-written migration this session (Prisma's diff engine doesn't
-- understand the `search_vector` GENERATED ALWAYS AS column). Stripped here,
-- as in every prior migration.

-- CreateEnum
CREATE TYPE "SellerActivationStatus" AS ENUM ('auto_approved', 'pending_review', 'blocked');

-- CreateEnum
CREATE TYPE "SellerLifecycleStatus" AS ENUM ('active', 'warned', 'restricted', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "NameConsistencyStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');

-- AlterTable: sellers (FR-30.1 CNIC, FR-30.5 risk score/activation, FR-29.4 lifecycle, FR-29.1 agreement)
ALTER TABLE "sellers" ADD COLUMN     "activation_status" "SellerActivationStatus" NOT NULL DEFAULT 'auto_approved',
ADD COLUMN     "agreement_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "agreement_accepted_ip" TEXT,
ADD COLUMN     "agreement_accepted_version" TEXT,
ADD COLUMN     "cnic_encrypted" TEXT,
ADD COLUMN     "cnic_hash" TEXT,
ADD COLUMN     "lifecycle_status" "SellerLifecycleStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "risk_score" INTEGER;

-- AlterTable: store_payment_instructions (FR-30.2 name-consistency, FR-30.3 fingerprint uniqueness)
ALTER TABLE "store_payment_instructions" ADD COLUMN     "bank_account_number_hash" TEXT,
ADD COLUMN     "easypaisa_account_title" TEXT,
ADD COLUMN     "easypaisa_number_hash" TEXT,
ADD COLUMN     "jazzcash_account_title" TEXT,
ADD COLUMN     "jazzcash_number_hash" TEXT,
ADD COLUMN     "name_consistency_status" "NameConsistencyStatus" NOT NULL DEFAULT 'not_required',
ADD COLUMN     "name_declared_self_owned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: user_security_events (FR-30.5 device fingerprint)
ALTER TABLE "user_security_events" ADD COLUMN     "device_fingerprint" TEXT;

-- CreateTable: seller_agreement_versions (FR-29.1) - a global catalog table
-- (no seller/store FK), same "no RLS needed" precedent as `themes`/`plans`.
CREATE TABLE "seller_agreement_versions" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_agreement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_agreement_versions_version_key" ON "seller_agreement_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_cnic_hash_key" ON "sellers"("cnic_hash");

-- CreateIndex
CREATE UNIQUE INDEX "store_payment_instructions_bank_account_number_hash_key" ON "store_payment_instructions"("bank_account_number_hash");

-- CreateIndex
CREATE UNIQUE INDEX "store_payment_instructions_jazzcash_number_hash_key" ON "store_payment_instructions"("jazzcash_number_hash");

-- CreateIndex
CREATE UNIQUE INDEX "store_payment_instructions_easypaisa_number_hash_key" ON "store_payment_instructions"("easypaisa_number_hash");
