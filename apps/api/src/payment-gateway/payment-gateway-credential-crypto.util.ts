import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

/**
 * AES-256-GCM at the application layer for a seller's connected payment-
 * gateway API key/secret (SRS §5.6h/FR-6.36) - identical shape to
 * order-verification/smtp-credential-crypto.util.ts, but under its own
 * PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY so this secret rotates
 * independently of every other credential type in this codebase. Packed as
 * `iv:authTag:ciphertext`, each base64.
 */
export function encryptGatewayCredential(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptGatewayCredential(packed: string, key: Buffer): string {
  const [ivB64, authTagB64, ciphertextB64] = packed.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted payment-gateway credential (expected iv:authTag:ciphertext).");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
