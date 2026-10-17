import { randomBytes } from "crypto";
import { decryptGatewayCredential, encryptGatewayCredential } from "./payment-gateway-credential-crypto.util";

describe("payment-gateway-credential-crypto.util", () => {
  const key = randomBytes(32);

  it("round-trips a plaintext gateway API key", () => {
    const packed = encryptGatewayCredential("raast-api-key-123", key);
    expect(decryptGatewayCredential(packed, key)).toBe("raast-api-key-123");
  });

  it("packs as iv:authTag:ciphertext, all base64, never the plaintext itself", () => {
    const packed = encryptGatewayCredential("super-secret", key);
    const parts = packed.split(":");
    expect(parts).toHaveLength(3);
    expect(packed).not.toContain("super-secret");
  });

  it("fails to decrypt under a different key (authenticity guarantee)", () => {
    const packed = encryptGatewayCredential("super-secret", key);
    expect(() => decryptGatewayCredential(packed, randomBytes(32))).toThrow();
  });

  // D87 - decryptGatewayCredential is now a re-export of
  // decryptDriveToken (drive-token-crypto.util.ts); its error message
  // names "Drive token" generically, same as identity-crypto.util.ts's
  // own pre-existing re-export already does for CNIC/payment-instrument
  // fingerprints - one shared message, not a per-domain string.
  it("rejects a malformed packed string", () => {
    expect(() => decryptGatewayCredential("not-a-valid-packed-value", key)).toThrow(/Malformed encrypted Drive token/);
  });
});
