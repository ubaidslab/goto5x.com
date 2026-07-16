import { createHash, randomBytes } from "crypto";

/**
 * Returns a random token to send to the user (in a link/email) and the hash
 * of it to store in the database - the raw token is never persisted, only
 * its hash, so a database read can't be used to forge a valid reset/verify
 * link (SRS FR-25.1/§6.5).
 */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
