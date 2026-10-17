import { ConfigService } from "@nestjs/config";
import { GatewayCredentialVaultService } from "./gateway-credential-vault.service";
import { KmsProvider } from "./kms/kms-provider.interface";

function buildFakeKms(overrides: Partial<KmsProvider> = {}): KmsProvider {
  let counter = 0;
  const keysByWrapped = new Map<string, Buffer>();
  return {
    name: "fake-kms",
    isProductionSafe: true,
    generateDataKey: jest.fn(async () => {
      const plaintextKey = Buffer.alloc(32, counter++);
      const wrappedKey = `wrapped-${counter}`;
      keysByWrapped.set(wrappedKey, plaintextKey);
      return { plaintextKey, wrappedKey };
    }),
    unwrapDataKey: jest.fn(async (wrappedKey: string) => {
      const key = keysByWrapped.get(wrappedKey);
      if (!key) throw new Error("Unknown wrapped key");
      return key;
    }),
    ...overrides,
  };
}

function buildConfig(nodeEnv: string): ConfigService {
  return { get: jest.fn().mockReturnValue(nodeEnv) } as unknown as ConfigService;
}

describe("GatewayCredentialVaultService", () => {
  it("round-trips a secret through issueDataKey -> encryptWithDataKey -> decrypt", async () => {
    const vault = new GatewayCredentialVaultService(buildFakeKms(), buildConfig("test"));
    const { plaintextKey, wrappedDataKey } = await vault.issueDataKey();
    const ciphertext = vault.encryptWithDataKey("sk_test_abc123", plaintextKey);

    expect(ciphertext).not.toContain("sk_test_abc123");
    const decrypted = await vault.decrypt(ciphertext, wrappedDataKey);
    expect(decrypted).toBe("sk_test_abc123");
  });

  it("encrypts two fields under the same issued data key with one wrapped-data-key value", async () => {
    const vault = new GatewayCredentialVaultService(buildFakeKms(), buildConfig("test"));
    const { plaintextKey, wrappedDataKey } = await vault.issueDataKey();
    const apiKeyCiphertext = vault.encryptWithDataKey("key-123", plaintextKey);
    const apiSecretCiphertext = vault.encryptWithDataKey("secret-456", plaintextKey);

    expect(await vault.decrypt(apiKeyCiphertext, wrappedDataKey)).toBe("key-123");
    expect(await vault.decrypt(apiSecretCiphertext, wrappedDataKey)).toBe("secret-456");
  });

  it("refuses to issue a data key (and therefore store a secret) in production with a non-production-safe KMS", async () => {
    const vault = new GatewayCredentialVaultService(buildFakeKms({ isProductionSafe: false, name: "local-dev" }), buildConfig("production"));
    await expect(vault.issueDataKey()).rejects.toThrow(/Refusing to store a gateway secret/);
  });

  it("allows issuing a data key outside production even with a non-production-safe KMS", async () => {
    const vault = new GatewayCredentialVaultService(buildFakeKms({ isProductionSafe: false, name: "local-dev" }), buildConfig("test"));
    await expect(vault.issueDataKey()).resolves.toBeDefined();
  });

  it("never blocks decrypt(), even in production with a non-production-safe KMS", async () => {
    const devKms = buildFakeKms({ isProductionSafe: false, name: "local-dev" });
    const vaultInDev = new GatewayCredentialVaultService(devKms, buildConfig("test"));
    const { plaintextKey, wrappedDataKey } = await vaultInDev.issueDataKey();
    const ciphertext = vaultInDev.encryptWithDataKey("legacy-secret", plaintextKey);

    const vaultInProd = new GatewayCredentialVaultService(devKms, buildConfig("production"));
    await expect(vaultInProd.decrypt(ciphertext, wrappedDataKey)).resolves.toBe("legacy-secret");
  });
});
