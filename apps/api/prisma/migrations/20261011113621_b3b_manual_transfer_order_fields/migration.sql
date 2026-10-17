-- B3b (founder decision, 2026-10-11) - the "advance" payment model's
-- Manual Transfer fallback for sellers with no live gateway: a buyer's
-- self-reported transaction reference + sender name, reviewed by the
-- seller against their own bank account before they call the pre-existing
-- markAsPaid()/changeStatus("cancelled") actions. No new OrderStatus.
--
-- Hand-written rather than `prisma migrate dev`-generated: this sandbox's
-- local database has pre-existing, unrelated drift against the migration
-- history (products.search_vector is a generated column that a blind
-- `migrate dev` diff tried to ALTER ... SET DEFAULT on, among other
-- unrelated noise - renamed indexes, unrelated column-type changes). This
-- file contains only the three columns this feature actually needs.
ALTER TABLE "orders" ADD COLUMN "manual_transfer_reference" TEXT,
ADD COLUMN "manual_transfer_sender_name" TEXT,
ADD COLUMN "manual_transfer_submitted_at" TIMESTAMPTZ;
