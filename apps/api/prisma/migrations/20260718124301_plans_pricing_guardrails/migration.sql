-- Module 14: Plans, Pricing & Guard-Rails (SRS v0.19, §5.7/§5.23/§5.31).
--
-- Note: `prisma migrate diff` also proposed `DROP INDEX "idx_products_search"`
-- and `ALTER TABLE "products" ALTER COLUMN "search_vector" DROP DEFAULT` -
-- the same known Module 5 generated-column false-positive stripped from
-- every prior hand-written migration this session (Prisma's diff engine
-- doesn't understand the `search_vector` GENERATED ALWAYS AS column).
-- Stripped here too.

-- CreateEnum
CREATE TYPE "PlanGroup" AS ENUM ('individual', 'team', 'supplier');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('pending_invite', 'active', 'left', 'declined');

-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('commission', 'plan_subscription', 'group_sponsorship');

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "size_bytes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "plan_group" "PlanGroup" NOT NULL DEFAULT 'individual',
ADD COLUMN     "seat_price" DECIMAL(12,2),
ADD COLUMN     "tier_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "seller_invoices" ADD COLUMN     "invoice_type" "InvoiceType" NOT NULL DEFAULT 'commission',
ADD COLUMN     "team_id" UUID;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "dormant_warning_sent_at" TIMESTAMPTZ,
ADD COLUMN     "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "current_period_end" TIMESTAMPTZ,
    "pending_plan_id" UUID,
    "sponsored_by_team_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "leader_seller_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'pending_invite',
    "consent_accepted_at" TIMESTAMPTZ,
    "invited_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMPTZ,
    "left_at" TIMESTAMPTZ,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_promo_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "PromoDiscountType" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "target_user_id" UUID,
    "max_redemptions" INTEGER NOT NULL DEFAULT 1,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_promo_code_redemptions" (
    "id" UUID NOT NULL,
    "promo_code_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "redeemed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_promo_code_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_seller_id_key" ON "subscriptions"("seller_id");

-- CreateIndex
CREATE INDEX "idx_teams_leader" ON "teams"("leader_seller_id");

-- CreateIndex
CREATE INDEX "idx_team_members_team" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "idx_team_members_seller" ON "team_members"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_promo_codes_code_key" ON "platform_promo_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "platform_promo_code_redemptions_promo_code_id_seller_id_key" ON "platform_promo_code_redemptions"("promo_code_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_plan_group_tier_order_key" ON "plans"("plan_group", "tier_order");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pending_plan_id_fkey" FOREIGN KEY ("pending_plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_sponsored_by_team_id_fkey" FOREIGN KEY ("sponsored_by_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_seller_id_fkey" FOREIGN KEY ("leader_seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_promo_codes" ADD CONSTRAINT "platform_promo_codes_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_promo_codes" ADD CONSTRAINT "platform_promo_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_promo_code_redemptions" ADD CONSTRAINT "platform_promo_code_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "platform_promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_promo_code_redemptions" ADD CONSTRAINT "platform_promo_code_redemptions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FR-7.11: a seller can be an active sponsored member of at most one team
-- at a time. Prisma's schema DSL has no partial-unique-index syntax, so
-- this is hand-written (not diffable from schema.prisma).
CREATE UNIQUE INDEX "idx_team_members_one_active_sponsorship" ON "team_members" ("seller_id") WHERE "status" = 'active';

-- AddForeignKey
ALTER TABLE "seller_invoices" ADD CONSTRAINT "seller_invoices_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

