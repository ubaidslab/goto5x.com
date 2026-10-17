-- D126 (founder privacy directive) - the buyer's raw IP must never be
-- persisted, not even transiently. The 20261016103000_order_fraud_flags
-- migration added this column; this one removes it. The repeat-IP fraud
-- signal is now derived entirely from a salted-hash counter in Redis
-- (short TTL, never written to Postgres) - see
-- CheckoutService.computeFraudFlags(). Only the resulting flag string in
-- "fraud_flags" (unaffected by this migration) is ever persisted.
ALTER TABLE "orders" DROP COLUMN "buyer_ip";
