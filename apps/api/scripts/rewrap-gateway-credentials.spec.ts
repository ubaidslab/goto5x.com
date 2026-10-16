import { randomBytes } from "crypto";
import { GatewayCredentialVaultService } from "../src/payment-gateway/gateway-credential-vault.service";
import { LocalDevKmsProvider } from "../src/payment-gateway/kms/local-dev-kms.provider";
import { encryptGatewayCredential } from "../src/payment-gateway/payment-gateway-credential-crypto.util";
import { buildEnvConfigService, rewrapTable } from "./rewrap-gateway-credentials";

/**
 * D117/D126 (founder decision) - proves the actual decrypt-old /
 * issue-new-data-key / encrypt-new / idempotent-skip behavior
 * rewrap-gateway-credentials.ts performs, against a real
 * LocalDevKmsProvider + GatewayCredentialVaultService (no mocking of the
 * crypto itself - only the Prisma update call is faked, same as
 * scripts/rotate-encryption-key.spec.ts's own choice not to touch a real
 * DB for a script that otherwise needs one).
 */
describe("rewrap-gateway-credentials", () => {
  const OLD_KEY = randomBytes(32);

  function buildVault() {
    const config = buildEnvConfigService();
    const kms = new LocalDevKmsProvider({
      getOrThrow: () => randomBytes(32).toString("base64"),
    } as never);
    return new GatewayCredentialVaultService(kms, config);
  }

  beforeEach(() => {
    process.env.LOCAL_DEV_KMS_MASTER_KEY = randomBytes(32).toString("base64");
  });

  it("re-wraps a row still under the old static-key scheme", async () => {
    const vault = buildVault();
    const row = {
      id: "row-1",
      apiKeyEncrypted: encryptGatewayCredential("sk_old_scheme_key", OLD_KEY),
      apiSecretEncrypted: encryptGatewayCredential("sk_old_scheme_secret", OLD_KEY),
      dataKeyWrapped: null,
    };
    const updates: Record<string, { apiKeyEncrypted: string; apiSecretEncrypted: string | null; dataKeyWrapped: string }> = {};
    const updateRow = jest.fn(async (id: string, u: typeof updates[string]) => {
      updates[id] = u;
    });

    const tally = await rewrapTable("test_table", [row], OLD_KEY, vault, updateRow, false);

    expect(tally).toEqual({ rewrapped: 1, skippedAlreadyDone: 0, skippedNoCredentials: 0, failed: 0 });
    expect(updateRow).toHaveBeenCalledTimes(1);
    expect(await vault.decrypt(updates["row-1"].apiKeyEncrypted, updates["row-1"].dataKeyWrapped)).toBe("sk_old_scheme_key");
    expect(await vault.decrypt(updates["row-1"].apiSecretEncrypted!, updates["row-1"].dataKeyWrapped)).toBe("sk_old_scheme_secret");
  });

  it("is idempotent - a row that already has dataKeyWrapped set is skipped, never touched again", async () => {
    const vault = buildVault();
    const row = {
      id: "row-2",
      apiKeyEncrypted: "some-new-scheme-ciphertext",
      apiSecretEncrypted: null,
      dataKeyWrapped: "already-set-wrapped-key",
    };
    const updateRow = jest.fn();

    const tally = await rewrapTable("test_table", [row], OLD_KEY, vault, updateRow, false);

    expect(tally).toEqual({ rewrapped: 0, skippedAlreadyDone: 1, skippedNoCredentials: 0, failed: 0 });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("skips a row with no credentials at all (nothing to migrate)", async () => {
    const vault = buildVault();
    const row = { id: "row-3", apiKeyEncrypted: null, apiSecretEncrypted: null, dataKeyWrapped: null };
    const updateRow = jest.fn();

    const tally = await rewrapTable("test_table", [row], OLD_KEY, vault, updateRow, false);

    expect(tally).toEqual({ rewrapped: 0, skippedAlreadyDone: 0, skippedNoCredentials: 1, failed: 0 });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("records a failure (and never calls updateRow) if the old key can't decrypt a row", async () => {
    const vault = buildVault();
    const wrongOldKey = randomBytes(32);
    const row = {
      id: "row-4",
      apiKeyEncrypted: encryptGatewayCredential("secret", wrongOldKey), // encrypted under a DIFFERENT "old" key
      apiSecretEncrypted: null,
      dataKeyWrapped: null,
    };
    const updateRow = jest.fn();

    const tally = await rewrapTable("test_table", [row], OLD_KEY, vault, updateRow, false);

    expect(tally).toEqual({ rewrapped: 0, skippedAlreadyDone: 0, skippedNoCredentials: 0, failed: 1 });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("--dry-run computes the would-be result without calling updateRow", async () => {
    const vault = buildVault();
    const row = {
      id: "row-5",
      apiKeyEncrypted: encryptGatewayCredential("sk_old_scheme_key", OLD_KEY),
      apiSecretEncrypted: null,
      dataKeyWrapped: null,
    };
    const updateRow = jest.fn();

    const tally = await rewrapTable("test_table", [row], OLD_KEY, vault, updateRow, true);

    expect(tally).toEqual({ rewrapped: 1, skippedAlreadyDone: 0, skippedNoCredentials: 0, failed: 0 });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("running the migration twice in a row is a true no-op the second time", async () => {
    const vault = buildVault();
    let row: { id: string; apiKeyEncrypted: string | null; apiSecretEncrypted: string | null; dataKeyWrapped: string | null } = {
      id: "row-6",
      apiKeyEncrypted: encryptGatewayCredential("sk_old_scheme_key", OLD_KEY),
      apiSecretEncrypted: null,
      dataKeyWrapped: null,
    };
    const updateRow = jest.fn(async (_id: string, u: { apiKeyEncrypted: string; apiSecretEncrypted: string | null; dataKeyWrapped: string }) => {
      row = { ...row, ...u };
    });

    const first = await rewrapTable("test_table", [row], OLD_KEY, vault, updateRow, false);
    expect(first.rewrapped).toBe(1);

    const second = await rewrapTable("test_table", [row], OLD_KEY, vault, updateRow, false);
    expect(second).toEqual({ rewrapped: 0, skippedAlreadyDone: 1, skippedNoCredentials: 0, failed: 0 });
    expect(updateRow).toHaveBeenCalledTimes(1); // only once, from the first run
  });
});
