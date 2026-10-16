import { hashBuyerIpForFraudSignal } from "./fraud-signal.util";

describe("hashBuyerIpForFraudSignal", () => {
  const secret = "test-hmac-secret";

  it("is deterministic - the same IP under the same secret always hashes the same", () => {
    expect(hashBuyerIpForFraudSignal("203.0.113.42", secret)).toBe(hashBuyerIpForFraudSignal("203.0.113.42", secret));
  });

  it("different IPs hash differently", () => {
    expect(hashBuyerIpForFraudSignal("203.0.113.42", secret)).not.toBe(hashBuyerIpForFraudSignal("203.0.113.43", secret));
  });

  it("the same IP under a different secret hashes differently (fingerprint isn't recoverable without the secret)", () => {
    expect(hashBuyerIpForFraudSignal("203.0.113.42", secret)).not.toBe(hashBuyerIpForFraudSignal("203.0.113.42", "a-different-secret"));
  });

  it("never returns the IP itself, or leaks it as a substring of the output", () => {
    const hash = hashBuyerIpForFraudSignal("203.0.113.42", secret);
    expect(hash).not.toBe("203.0.113.42");
    expect(hash).not.toContain("203.0.113.42");
    expect(hash).not.toContain("203");
  });

  it("produces a fixed-length hex digest regardless of IPv4 vs IPv6 input", () => {
    const v4 = hashBuyerIpForFraudSignal("203.0.113.42", secret);
    const v6 = hashBuyerIpForFraudSignal("2001:db8::1", secret);
    expect(v4).toMatch(/^[0-9a-f]{64}$/);
    expect(v6).toMatch(/^[0-9a-f]{64}$/);
  });
});
