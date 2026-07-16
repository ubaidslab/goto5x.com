import { generateToken, hashToken } from "./token.util";

describe("token.util", () => {
  it("produces a token whose hash matches hashToken(token)", () => {
    const { token, tokenHash } = generateToken();
    expect(hashToken(token)).toBe(tokenHash);
  });

  it("never returns the raw token as something resembling its own hash", () => {
    const { token, tokenHash } = generateToken();
    expect(token).not.toEqual(tokenHash);
  });

  it("generates a different token every call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).not.toEqual(b.token);
  });

  it("hashToken is deterministic for the same input", () => {
    expect(hashToken("abc")).toEqual(hashToken("abc"));
  });
});
