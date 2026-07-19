import { computeSignature, isTimestampFresh, verifySignature } from "./signature.util";

describe("External-API HMAC signature scheme (SRS §6.5, FR-24.6/FR-24.14)", () => {
  const secret = "test-signing-secret";

  it("verifies a correctly-signed payload", () => {
    const timestamp = "1700000000000";
    const payload = '{"sellerId":"abc"}';
    const signature = computeSignature(secret, timestamp, payload);
    expect(verifySignature(secret, timestamp, payload, signature)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const timestamp = "1700000000000";
    const payload = '{"sellerId":"abc"}';
    const signature = computeSignature("a-different-secret", timestamp, payload);
    expect(verifySignature(secret, timestamp, payload, signature)).toBe(false);
  });

  it("rejects a signature whose payload was tampered with after signing", () => {
    const timestamp = "1700000000000";
    const signature = computeSignature(secret, timestamp, '{"sellerId":"abc"}');
    expect(verifySignature(secret, timestamp, '{"sellerId":"xyz"}', signature)).toBe(false);
  });

  it("rejects a signature computed against a different timestamp than the one supplied", () => {
    const payload = '{"sellerId":"abc"}';
    const signature = computeSignature(secret, "1700000000000", payload);
    expect(verifySignature(secret, "1700000000001", payload, signature)).toBe(false);
  });

  it("rejects a malformed (non-hex) signature without throwing", () => {
    expect(verifySignature(secret, "1700000000000", "payload", "not-valid-hex-zzz")).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifySignature(secret, "1700000000000", "payload", "")).toBe(false);
  });

  it("treats a timestamp within the replay-tolerance window as fresh", () => {
    const now = 1700000000000;
    expect(isTimestampFresh(String(now - 60_000), now)).toBe(true);
    expect(isTimestampFresh(String(now + 60_000), now)).toBe(true);
  });

  it("rejects a timestamp outside the replay-tolerance window (stale or clock-skewed)", () => {
    const now = 1700000000000;
    expect(isTimestampFresh(String(now - 6 * 60_000), now)).toBe(false);
    expect(isTimestampFresh(String(now + 6 * 60_000), now)).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(isTimestampFresh("not-a-number")).toBe(false);
  });
});
