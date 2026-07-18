import { InvalidCnicError, maskCnic, normalizeAndValidateCnic } from "./cnic.util";

describe("normalizeAndValidateCnic (SRS FR-30.1)", () => {
  it("accepts a well-formed, Luhn-valid 13-digit CNIC, with or without dashes", () => {
    expect(normalizeAndValidateCnic("3541234567899")).toBe("3541234567899");
    expect(normalizeAndValidateCnic("35412-3456789-9")).toBe("3541234567899");
  });

  it("rejects a CNIC that isn't exactly 13 digits", () => {
    expect(() => normalizeAndValidateCnic("12345")).toThrow(InvalidCnicError);
    expect(() => normalizeAndValidateCnic("12345678901234")).toThrow(InvalidCnicError);
  });

  it("rejects non-numeric input", () => {
    expect(() => normalizeAndValidateCnic("abcdefghijklm")).toThrow(InvalidCnicError);
  });

  it("rejects a 13-digit input that fails the checksum", () => {
    expect(() => normalizeAndValidateCnic("3541234567890")).toThrow(InvalidCnicError);
  });
});

describe("maskCnic (SRS FR-30.1)", () => {
  it("shows only the last 4 digits, masking the rest", () => {
    expect(maskCnic("3541234567899")).toBe("•••••••••7899");
  });
});
