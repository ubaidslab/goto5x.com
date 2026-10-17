import { createHmac } from "crypto";

/**
 * D126 (founder privacy directive) - the buyer's IP must never be persisted
 * anywhere, not even transiently, for the repeat-IP fraud signal. This is a
 * deterministic, non-reversible HMAC fingerprint (same primitive as
 * identity-crypto.util.ts's fingerprintValue(), but without that function's
 * alphanumeric-stripping normalization - which is correct for a CNIC/phone-
 * style identity number but would be wrong here: an IP's dots/colons are
 * structurally meaningful, not formatting noise, so normalizing them away
 * could collide two different IPs). Reuses IDENTITY_FINGERPRINT_HMAC_SECRET
 * rather than a new secret, domain-separated by the fixed prefix below.
 */
export function hashBuyerIpForFraudSignal(ip: string, hmacSecret: string): string {
  return createHmac("sha256", hmacSecret).update(`fraud-ip:${ip}`).digest("hex");
}
