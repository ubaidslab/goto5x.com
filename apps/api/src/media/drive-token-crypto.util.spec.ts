import { randomBytes } from "crypto";
import { decryptDriveToken, encryptDriveToken } from "./drive-token-crypto.util";

describe("drive-token-crypto.util", () => {
  const key = randomBytes(32);

  it("round-trips a refresh token through encrypt/decrypt", () => {
    const plaintext = "1//0g-real-looking-google-refresh-token";
    const packed = encryptDriveToken(plaintext, key);
    expect(packed).not.toContain(plaintext);
    expect(decryptDriveToken(packed, key)).toBe(plaintext);
  });

  it("fails to decrypt with the wrong key (authenticity, not just confidentiality)", () => {
    const packed = encryptDriveToken("some-refresh-token", key);
    const wrongKey = randomBytes(32);
    expect(() => decryptDriveToken(packed, wrongKey)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const packed = encryptDriveToken("some-refresh-token", key);
    const [iv, authTag, ciphertext] = packed.split(":");
    const tamperedByte = Buffer.from(ciphertext, "base64");
    tamperedByte[0] = tamperedByte[0] ^ 0xff;
    const tampered = [iv, authTag, tamperedByte.toString("base64")].join(":");
    expect(() => decryptDriveToken(tampered, key)).toThrow();
  });

  it("rejects a malformed packed value", () => {
    expect(() => decryptDriveToken("not-the-right-shape", key)).toThrow(/Malformed/);
  });
});
