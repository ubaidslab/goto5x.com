-- Module 35 (SRS §5.52/FR-52.1-52.6) - Staff Accounts, plan-tier. Seller-
-- owned, deliberately seller-scoped only (no store_id) - same "no RLS,
-- explicit seller_id filter" discipline as seller_verification_emails,
-- since a staff account's access spans all of the owner's stores.

CREATE TYPE "StaffScope" AS ENUM ('orders', 'catalog', 'discounts', 'customers', 'design');
CREATE TYPE "StaffAccountStatus" AS ENUM ('active', 'revoked');

CREATE TABLE "staff_accounts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "scopes" "StaffScope"[] NOT NULL,
    "status" "StaffAccountStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_accounts_email_key" ON "staff_accounts"("email");
CREATE INDEX "idx_staff_accounts_seller" ON "staff_accounts"("seller_id");

ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
