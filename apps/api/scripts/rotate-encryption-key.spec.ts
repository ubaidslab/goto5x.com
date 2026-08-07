import { randomBytes } from "crypto";
import { decryptDriveToken, encryptDriveToken } from "../src/media/drive-token-crypto.util";
import { decryptSmtpCredential, encryptSmtpCredential } from "../src/order-verification/smtp-credential-crypto.util";
import { decryptAdminEmailCredential, encryptAdminEmailCredential } from "../src/admin-email/admin-email-credential-crypto.util";

/**
 * Phase B pre-launch audit finding (key rotation utility). Proves the exact
 * decrypt-with-old / re-encrypt-with-new round trip
 * scripts/rotate-encryption-key.ts performs, using the same crypto
 * functions the script imports, for all three distinct implementations in
 * the codebase (the five domains map onto three - CNIC/Drive-token/
 * external-API-secret all reuse encryptDriveToken/decryptDriveToken
 * verbatim). Doesn't touch a real DB - that's what the script itself needs
 * a live Postgres for; this pins the cryptographic correctness the script
 * depends on.
 */
describe("Encryption key rotation - decrypt-with-old / re-encrypt-with-new round trip", () => {
  const CASES: Array<{
    label: string;
    encrypt: (plaintext: string, key: Buffer) => string;
    decrypt: (packed: string, key: Buffer) => string;
  }> = [
    { label: "drive-token (also used verbatim for CNIC and external-api-secret)", encrypt: encryptDriveToken, decrypt: decryptDriveToken },
    { label: "seller-smtp", encrypt: encryptSmtpCredential, decrypt: decryptSmtpCredential },
    { label: "admin-email", encrypt: encryptAdminEmailCredential, decrypt: decryptAdminEmailCredential },
  ];

  it.each(CASES)("$label: round-trips a plaintext through old-key decrypt then new-key encrypt then new-key decrypt", ({ encrypt, decrypt }) => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const plaintext = "a real secret value, e.g. a refresh token or app password";

    const oldCiphertext = encrypt(plaintext, oldKey);
    const decrypted = decrypt(oldCiphertext, oldKey);
    expect(decrypted).toBe(plaintext);

    const newCiphertext = encrypt(decrypted, newKey);
    expect(decrypt(newCiphertext, newKey)).toBe(plaintext);
  });

  it.each(CASES)("$label: the old key can no longer decrypt ciphertext rotated to the new key", ({ encrypt, decrypt }) => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const plaintext = "a real secret value";

    const rotated = encrypt(plaintext, newKey);
    expect(() => decrypt(rotated, oldKey)).toThrow();
  });

  it.each(CASES)("$label: the new key cannot decrypt ciphertext still encrypted under the old key (proves rotation isn't a no-op)", ({ encrypt, decrypt }) => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const stillOld = encrypt("unrotated value", oldKey);
    expect(() => decrypt(stillOld, newKey)).toThrow();
  });
});
