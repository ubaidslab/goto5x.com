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

  it("rejects a malformed packed string", () => {
    expect(() => decryptGatewayCredential("not-a-valid-packed-value", key)).toThrow(
      /Malformed encrypted payment-gateway credential/,
    );
  });
});
