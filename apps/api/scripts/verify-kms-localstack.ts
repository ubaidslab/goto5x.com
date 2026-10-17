import { ConfigService } from "@nestjs/config";
import { AwsKmsProvider } from "../src/payment-gateway/kms/aws-kms.provider";

/**
 * D117/D126 (founder decision) - "tested with mocks/LocalStack in CI."
 * aws-kms.provider.spec.ts proves AwsKmsProvider's own logic against a
 * mocked AWS SDK client (fast, no network, runs everywhere); this script
 * is the OTHER half - a real round trip over the network, with the real
 * AWS SDK's request signing/wire format, against a LocalStack-emulated
 * KMS endpoint. Only ever run by CI's kms-localstack-test job
 * (.github/workflows/ci.yml), which provisions the LocalStack container,
 * creates a test CMK in it, and passes this script AWS_KMS_KEY_ID/
 * AWS_REGION/AWS_KMS_ENDPOINT plus dummy AWS credentials (LocalStack
 * accepts any values - it never validates them).
 *
 * Deliberately not a Jest test: there is no safe Jest root/pattern in
 * this repo that would pick this up ONLY in that one CI job and nowhere
 * else (jest.config.js's unit suite and jest.e2e.config.js's Postgres/
 * Redis suite would otherwise also try to run it, and fail, everywhere
 * LocalStack isn't running - including this sandbox). Same reasoning
 * the pre-existing backup-restore-drill CI job already uses raw
 * commands instead of Jest for its own real-infrastructure check.
 *
 * Usage: npx ts-node scripts/verify-kms-localstack.ts
 */

function buildEnvConfigService(): ConfigService {
  return {
    get: (key: string) => process.env[key],
    getOrThrow: (key: string) => {
      const value = process.env[key];
      if (value === undefined) throw new Error(`Missing required env var: ${key}`);
      return value;
    },
  } as unknown as ConfigService;
}

async function main() {
  const provider = new AwsKmsProvider(buildEnvConfigService());

  // eslint-disable-next-line no-console
  console.log(`Generating a data key via AWS KMS (endpoint: ${process.env.AWS_KMS_ENDPOINT ?? "real AWS"})...`);
  const { plaintextKey, wrappedKey } = await provider.generateDataKey();
  if (plaintextKey.length !== 32) {
    throw new Error(`Expected a 32-byte (AES-256) data key, got ${plaintextKey.length} bytes.`);
  }
  // eslint-disable-next-line no-console
  console.log(`Got a ${plaintextKey.length}-byte plaintext key and a ${wrappedKey.length}-char wrapped (base64) form.`);

  // eslint-disable-next-line no-console
  console.log("Unwrapping it back via AWS KMS Decrypt...");
  const unwrapped = await provider.unwrapDataKey(wrappedKey);

  if (!unwrapped.equals(plaintextKey)) {
    throw new Error("Round trip FAILED: the unwrapped data key does not match the originally generated one.");
  }

  // eslint-disable-next-line no-console
  console.log("OK - GenerateDataKey -> Decrypt round trip matches. The real AWS SDK v3 request/response path works end-to-end.");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("KMS LocalStack verification FAILED:", e);
  process.exit(1);
});
