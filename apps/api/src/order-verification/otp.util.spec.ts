import { generateOtp, hashOtp } from "./otp.util";

describe("otp.util", () => {
  it("generates a 6-digit numeric code paired with its SHA-256 hash", () => {
    const { code, codeHash } = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(codeHash).toBe(hashOtp(code));
  });

  it("hashOtp is deterministic and never returns the raw code", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
    expect(hashOtp("123456")).not.toBe("123456");
  });

  it("hashOtp differs for different codes", () => {
    expect(hashOtp("111111")).not.toBe(hashOtp("222222"));
  });

  it("zero-pads codes below 100000", () => {
    // randomInt(0, 1_000_000) can legitimately produce values like 42 -
    // padStart must keep the code exactly 6 characters wide either way.
    for (let i = 0; i < 50; i++) {
      expect(generateOtp().code).toHaveLength(6);
    }
  });
});
