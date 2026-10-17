import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { GatewayCredentialVaultService } from "../src/payment-gateway/gateway-credential-vault.service";
import { AwsKmsProvider } from "../src/payment-gateway/kms/aws-kms.provider";
import { KmsProvider } from "../src/payment-gateway/kms/kms-provider.interface";
import { LocalDevKmsProvider } from "../src/payment-gateway/kms/local-dev-kms.provider";
import { decryptGatewayCredential } from "../src/payment-gateway/payment-gateway-credential-crypto.util";

/**
 * D117/D126 (founder decision) - re-wraps every gateway credential still
 * under the OLD scheme (a single static PAYMENT_GATEWAY_CREDENTIAL_
 * ENCRYPTION_KEY, no envelope) into the NEW one: a fresh, KMS-wrapped data
 * key per row (GatewayCredentialVaultService). Idempotent by construction
 * - a row that already has dataKeyWrapped set is skipped, so running this
 * script twice (or interrupting and re-running it) never double-wraps or
 * corrupts an already-migrated row.
 *
 * Same "decrypt-then-encrypt-then-write, catch and skip a failed row
 * rather than abort the run, non-zero exit on any failure" discipline as
 * scripts/rotate-encryption-key.ts - deliberately connects its own
 * PrismaClient (DATABASE_ADMIN_URL) rather than bootstrapping Nest DI, for
 * the same reason that script does: this must run standalone, outside the
 * API process, during a migration window.
 *
 * Usage:
 *   npx ts-node scripts/rewrap-gateway-credentials.ts [--dry-run]
 *
 * Reads the OLD key from PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY (still
 * required until every row is migrated) and builds the active KmsProvider
 * from KMS_PROVIDER_TYPE and the usual env vars - exactly as the running
 * app would (kms.module.ts's own factory), just without going through
 * Nest's DI container to get there.
 */

interface GatewayConnectionRow {
  id: string;
  apiKeyEncrypted: string | null;
  apiSecretEncrypted: string | null;
  dataKeyWrapped: string | null;
}

interface RewrapTally {
  rewrapped: number;
  skippedAlreadyDone: number;
  skippedNoCredentials: number;
  failed: number;
}

export function buildEnvConfigService(): ConfigService {
  // Deliberately duck-typed, not a real Nest DI ConfigService - see this
  // file's own top comment. AwsKmsProvider/LocalDevKmsProvider/
  // GatewayCredentialVaultService only ever call .get()/.getOrThrow() on
  // whatever they're constructed with.
  return {
    get: (key: string) => process.env[key],
    getOrThrow: (key: string) => {
      const value = process.env[key];
      if (value === undefined) throw new Error(`Missing required env var: ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

export function buildKmsProviderFromEnv(config: ConfigService): KmsProvider {
  const type = config.get<string>("KMS_PROVIDER_TYPE") ?? "local-dev";
  return type === "aws" ? new AwsKmsProvider(config) : new LocalDevKmsProvider(config);
}

/** The core migration logic, kept separate from main()'s I/O so it's directly unit-testable against fake rows. */
export async function rewrapTable(
  label: string,
  rows: GatewayConnectionRow[],
  oldKey: Buffer,
  vault: GatewayCredentialVaultService,
  updateRow: (id: string, updates: { apiKeyEncrypted: string; apiSecretEncrypted: string | null; dataKeyWrapped: string }) => Promise<void>,
  dryRun: boolean,
): Promise<RewrapTally> {
  const tally: RewrapTally = { rewrapped: 0, skippedAlreadyDone: 0, skippedNoCredentials: 0, failed: 0 };

  for (const row of rows) {
    if (row.dataKeyWrapped) {
      tally.skippedAlreadyDone += 1; // idempotent - already migrated
      continue;
    }
    if (!row.apiKeyEncrypted) {
      tally.skippedNoCredentials += 1; // nothing to migrate for this row
      continue;
    }

    try {
      const apiKeyPlaintext = decryptGatewayCredential(row.apiKeyEncrypted, oldKey);
      const apiSecretPlaintext = row.apiSecretEncrypted ? decryptGatewayCredential(row.apiSecretEncrypted, oldKey) : null;

      const { plaintextKey, wrappedDataKey } = await vault.issueDataKey();
      const apiKeyEncrypted = vault.encryptWithDataKey(apiKeyPlaintext, plaintextKey);
      const apiSecretEncrypted = apiSecretPlaintext ? vault.encryptWithDataKey(apiSecretPlaintext, plaintextKey) : null;

      if (!dryRun) {
        await updateRow(row.id, { apiKeyEncrypted, apiSecretEncrypted, dataKeyWrapped: wrappedDataKey });
      }
      tally.rewrapped += 1;
    } catch (err) {
      tally.failed += 1;
      // eslint-disable-next-line no-console
      console.error(`  FAILED ${label} id=${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return tally;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = buildEnvConfigService();
  const oldKey = Buffer.from(config.getOrThrow<string>("PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY"), "base64");
  const kms = buildKmsProviderFromEnv(config);
  const vault = new GatewayCredentialVaultService(kms, config);

  // eslint-disable-next-line no-console
  console.log(`${dryRun ? "[DRY RUN] " : ""}Re-wrapping gateway credentials under envelope encryption (KMS provider: ${kms.name}).`);

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_ADMIN_URL } } });

  const storeConnections = await prisma.storePaymentGatewayConnection.findMany({
    select: { id: true, apiKeyEncrypted: true, apiSecretEncrypted: true, dataKeyWrapped: true },
  });
  const storeTally = await rewrapTable(
    "store_payment_gateway_connections",
    storeConnections,
    oldKey,
    vault,
    async (id, updates) => {
      await prisma.storePaymentGatewayConnection.update({ where: { id }, data: updates });
    },
    dryRun,
  );

  const platformConnections = await prisma.platformGatewayConnection.findMany({
    select: { id: true, apiKeyEncrypted: true, apiSecretEncrypted: true, dataKeyWrapped: true },
  });
  const platformTally = await rewrapTable(
    "platform_gateway_connections",
    platformConnections,
    oldKey,
    vault,
    async (id, updates) => {
      await prisma.platformGatewayConnection.update({ where: { id }, data: updates });
    },
    dryRun,
  );

  await prisma.$disconnect();

  for (const [label, tally, total] of [
    ["store_payment_gateway_connections", storeTally, storeConnections.length],
    ["platform_gateway_connections", platformTally, platformConnections.length],
  ] as const) {
    // eslint-disable-next-line no-console
    console.log(
      `${label}: ${total} row(s) - ${dryRun ? "would rewrap" : "rewrapped"} ${tally.rewrapped}, ` +
        `already migrated ${tally.skippedAlreadyDone}, no credentials ${tally.skippedNoCredentials}, failed ${tally.failed}.`,
    );
  }

  if (storeTally.failed + platformTally.failed > 0) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
}
