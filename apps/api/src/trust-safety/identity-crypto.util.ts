import { createHmac } from "crypto";
// Reused verbatim - the exact AES-256-GCM implementation already used for
// the Google Drive refresh token (SRS §5.30/FR-30.1: "same mechanism and
// key-management discipline"). One audited implementation, not a duplicate.
import { decryptDriveToken, encryptDriveToken } from "../media/drive-token-crypto.util";

export const encryptIdentityValue = encryptDriveToken;
export const decryptIdentityValue = decryptDriveToken;

/**
 * Deterministic (HMAC-SHA256) fingerprint for a uniqueness constraint -
 * never the plaintext, never intended to be reversed (unlike
 * encryptIdentityValue above, which must be decryptable). Used for the
 * CNIC hash (FR-30.1) and payment-instrument number fingerprints (FR-30.3).
 * Normalizes first (strip non-alphanumerics, lowercase) so formatting
 * differences never produce two different fingerprints for the same value.
 */
export function fingerprintValue(rawValue: string, hmacSecret: string): string {
  const normalized = rawValue.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return createHmac("sha256", hmacSecret).update(normalized).digest("hex");
}
