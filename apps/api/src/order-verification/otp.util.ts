import { createHash, randomInt } from "crypto";

/**
 * A 6-digit numeric OTP (Module 26, SRS §5.37/FR-37.5) - stored hashed,
 * never plaintext, same "generate + return the hash to store, the raw
 * value is sent out-of-band and never persisted" shape as
 * auth/token.util.ts's password-reset token.
 */
export function generateOtp(): { code: string; codeHash: string } {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return { code, codeHash: hashOtp(code) };
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
