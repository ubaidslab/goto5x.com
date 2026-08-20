-- AlterTable
ALTER TABLE "program_participants" ADD COLUMN "free_store_slots_granted" INTEGER;

-- AlterTable
ALTER TABLE "referral_attributions" ADD COLUMN "commission_months_paid" INTEGER NOT NULL DEFAULT 0;
