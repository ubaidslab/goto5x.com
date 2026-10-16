-- D116 item 5 (Stage 0, founder decision 2026-10-16) - "basic fraud flags."
-- A buyer's checkout IP (never persisted before - checkout.service.ts only
-- ever used it transiently for rate-limiting) plus a short, append-only
-- list of cheap, rule-based signals computed once at order-placement time
-- (disposable buyer email, several orders from the same IP in a short
-- window). Informational only - flows through the existing seller/admin
-- order read paths automatically (none of them use a narrowing `select`),
-- never blocks checkout and never replaces the existing Seller.riskScore
-- mechanism, which is a different, seller-identity signal.
--
-- Hand-written rather than `prisma migrate dev`-generated, same reason as
-- 20261011113621_b3b_manual_transfer_order_fields: this sandbox's local
-- database has pre-existing, unrelated drift against the migration
-- history, so a blind diff would include unrelated noise.
ALTER TABLE "orders" ADD COLUMN "buyer_ip" TEXT,
ADD COLUMN "fraud_flags" TEXT[] NOT NULL DEFAULT '{}';
