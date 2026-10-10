-- B2 (founder decision, 2026-10-10) - D10's locked 1/3/6/12-month cycle
-- ladder needs a 3-month option the enum never had. Added after the
-- existing values (monthly/yearly/none/six_month) specifically to leave
-- every one of those unchanged, per the founder's own explicit
-- instruction.
ALTER TYPE "PlanBillingInterval" ADD VALUE 'quarterly';

-- B2 - "a slot to map each plan + cycle to a provider price ID later."
-- Starts empty: 1C (after founder go-ahead) is where Stripe/Paddle
-- product/price objects actually get created and these rows populated;
-- this migration only prepares the table so that work needs no further
-- schema change.
-- CreateTable
CREATE TABLE "plan_cycle_provider_prices" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_interval" "PlanBillingInterval" NOT NULL,
    "stripe_price_id" TEXT,
    "paddle_price_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plan_cycle_provider_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_plan_cycle_provider_price" ON "plan_cycle_provider_prices"("plan_id", "billing_interval");

-- AddForeignKey
ALTER TABLE "plan_cycle_provider_prices" ADD CONSTRAINT "plan_cycle_provider_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
