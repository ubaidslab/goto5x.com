import { randomBytes } from "crypto";
import { decryptSmtpCredential, encryptSmtpCredential } from "./smtp-credential-crypto.util";

describe("smtp-credential-crypto.util", () => {
  const key = randomBytes(32);

  it("round-trips a plaintext SMTP password", () => {
    const packed = encryptSmtpCredential("app-password-123", key);
    expect(decryptSmtpCredential(packed, key)).toBe("app-password-123");
  });

  it("packs as iv:authTag:ciphertext, all base64, never the plaintext itself", () => {
    const packed = encryptSmtpCredential("super-secret", key);
    const parts = packed.split(":");
    expect(parts).toHaveLength(3);
    expect(packed).not.toContain("super-secret");
  });

  it("fails to decrypt under a different key (authenticity guarantee)", () => {
    const packed = encryptSmtpCredential("super-secret", key);
    expect(() => decryptSmtpCredential(packed, randomBytes(32))).toThrow();
  });

  // D87 - decryptSmtpCredential is now a re-export of decryptDriveToken
  // (drive-token-crypto.util.ts); its error message names "Drive token"
  // generically, same as identity-crypto.util.ts's own pre-existing
  // re-export already does for CNIC/payment-instrument fingerprints -
  // one shared message, not a per-domain string.
  it("rejects a malformed packed string", () => {
    expect(() => decryptSmtpCredential("not-a-valid-packed-value", key)).toThrow(/Malformed encrypted Drive token/);
  });
});
