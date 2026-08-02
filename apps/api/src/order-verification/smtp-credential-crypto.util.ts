import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

/**
 * AES-256-GCM at the application layer for a seller's connected SMTP
 * password (SRS §5.37/FR-37.3) - identical shape to
 * media/drive-token-crypto.util.ts, but under its own
 * SMTP_CREDENTIAL_ENCRYPTION_KEY so the two secrets rotate independently.
 * Packed as `iv:authTag:ciphertext`, each base64.
 */
export function encryptSmtpCredential(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSmtpCredential(packed: string, key: Buffer): string {
  const [ivB64, authTagB64, ciphertextB64] = packed.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted SMTP credential (expected iv:authTag:ciphertext).");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
