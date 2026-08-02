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

  it("rejects a malformed packed string", () => {
    expect(() => decryptSmtpCredential("not-a-valid-packed-value", key)).toThrow(
      /Malformed encrypted SMTP credential/,
    );
  });
});
