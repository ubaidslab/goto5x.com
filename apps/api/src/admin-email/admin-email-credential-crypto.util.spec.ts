import { randomBytes } from "crypto";
import { decryptAdminEmailCredential, encryptAdminEmailCredential } from "./admin-email-credential-crypto.util";

describe("admin-email-credential-crypto.util", () => {
  const key = randomBytes(32);

  it("round-trips a plaintext IMAP/SMTP password", () => {
    const packed = encryptAdminEmailCredential("app-password-123", key);
    expect(decryptAdminEmailCredential(packed, key)).toBe("app-password-123");
  });

  it("packs as iv:authTag:ciphertext, all base64, never the plaintext itself", () => {
    const packed = encryptAdminEmailCredential("super-secret", key);
    const parts = packed.split(":");
    expect(parts).toHaveLength(3);
    expect(packed).not.toContain("super-secret");
  });

  it("fails to decrypt under a different key (authenticity guarantee)", () => {
    const packed = encryptAdminEmailCredential("super-secret", key);
    expect(() => decryptAdminEmailCredential(packed, randomBytes(32))).toThrow();
  });

  it("rejects a malformed packed string", () => {
    expect(() => decryptAdminEmailCredential("not-a-valid-packed-value", key)).toThrow(
      /Malformed encrypted admin email credential/,
    );
  });
});
