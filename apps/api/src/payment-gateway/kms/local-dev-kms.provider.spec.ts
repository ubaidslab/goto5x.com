import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { LocalDevKmsProvider } from "./local-dev-kms.provider";

function buildProvider(masterKey = randomBytes(32).toString("base64")) {
  const config = { getOrThrow: jest.fn().mockReturnValue(masterKey) } as unknown as ConfigService;
  return new LocalDevKmsProvider(config);
}

describe("LocalDevKmsProvider", () => {
  it("identifies itself as not production-safe", () => {
    expect(buildProvider().isProductionSafe).toBe(false);
    expect(buildProvider().name).toBe("local-dev");
  });

  it("round-trips a generated data key through wrap/unwrap", async () => {
    const provider = buildProvider();
    const { plaintextKey, wrappedKey } = await provider.generateDataKey();
    expect(plaintextKey).toHaveLength(32);

    const unwrapped = await provider.unwrapDataKey(wrappedKey);
    expect(unwrapped).toEqual(plaintextKey);
  });

  it("never leaks the plaintext key inside the wrapped form", async () => {
    const provider = buildProvider();
    const { plaintextKey, wrappedKey } = await provider.generateDataKey();
    expect(wrappedKey).not.toContain(plaintextKey.toString("base64"));
  });

  it("generates a different data key (and wrapped form) on every call", async () => {
    const provider = buildProvider();
    const a = await provider.generateDataKey();
    const b = await provider.generateDataKey();
    expect(a.plaintextKey.equals(b.plaintextKey)).toBe(false);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
  });

  it("fails to unwrap a data key wrapped under a different master key", async () => {
    const provider = buildProvider();
    const { wrappedKey } = await provider.generateDataKey();
    const otherProvider = buildProvider();
    await expect(otherProvider.unwrapDataKey(wrappedKey)).rejects.toThrow();
  });
});
