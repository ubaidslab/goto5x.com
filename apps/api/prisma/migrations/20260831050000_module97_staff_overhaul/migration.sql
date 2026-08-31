-- Module 97 (SRS §5.52/FR-52.7-52.13, founder batch "Staff Accounts Overhaul")

ALTER TYPE "StaffScope" ADD VALUE 'analytics';
ALTER TYPE "StaffScope" ADD VALUE 'marketing';
ALTER TYPE "StaffScope" ADD VALUE 'reviews';
ALTER TYPE "StaffScope" ADD VALUE 'suppliers';

CREATE TYPE "StaffPermission" AS ENUM ('read', 'write');

ALTER TABLE "staff_accounts" DROP COLUMN "scopes";
ALTER TABLE "staff_accounts" ADD COLUMN "expires_at" TIMESTAMPTZ;
ALTER TABLE "staff_accounts" ADD COLUMN "device_restriction_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "staff_scope_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "staff_account_id" UUID NOT NULL,
  "scope" "StaffScope" NOT NULL,
  "permission" "StaffPermission" NOT NULL DEFAULT 'write',
  CONSTRAINT "staff_scope_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_staff_scope_permission" ON "staff_scope_permissions"("staff_account_id", "scope");

ALTER TABLE "staff_scope_permissions"
  ADD CONSTRAINT "staff_scope_permissions_staff_account_id_fkey"
  FOREIGN KEY ("staff_account_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "staff_devices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "staff_account_id" UUID NOT NULL,
  "device_id" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  CONSTRAINT "staff_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_staff_device" ON "staff_devices"("staff_account_id", "device_id");

ALTER TABLE "staff_devices"
  ADD CONSTRAINT "staff_devices_staff_account_id_fkey"
  FOREIGN KEY ("staff_account_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
