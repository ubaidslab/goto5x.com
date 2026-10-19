-- D135/B3 (Paddle) - Subscription gains the fields needed to bill a
-- seller through Paddle, plus the cross-rail Founding Members counter
-- and Paddle's own refund-request record (D11/D17/D134).

-- CreateEnum
CREATE TYPE "PaddleRefundRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "founding_member_ordinal" INTEGER,
ADD COLUMN     "is_founding_member" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paddle_customer_id" TEXT,
ADD COLUMN     "paddle_subscription_id" TEXT,
ADD COLUMN     "last_paddle_transaction_id" TEXT,
ADD COLUMN     "last_paddle_charged_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_paddle_subscription_id_key" ON "subscriptions"("paddle_subscription_id");

-- CreateTable
CREATE TABLE "founding_member_counter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "founding_member_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paddle_refund_requests" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "paddle_transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaddleRefundRequestStatus" NOT NULL DEFAULT 'pending',
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ,
    "decided_by_admin_id" UUID,
    "paddle_adjustment_id" TEXT,

    CONSTRAINT "paddle_refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paddle_refund_requests_seller_id_idx" ON "paddle_refund_requests"("seller_id");

-- AddForeignKey
ALTER TABLE "paddle_refund_requests" ADD CONSTRAINT "paddle_refund_requests_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the one Founding Members counter row - FoundingMembersService's
-- atomic UPDATE...WHERE count < 100 needs a row to match against; it
-- deliberately never creates one itself (that would need its own
-- check-then-insert race).
INSERT INTO "founding_member_counter" ("id", "count") VALUES (1, 0);
