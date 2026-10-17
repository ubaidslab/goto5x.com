export const KMS_PROVIDER = Symbol("KMS_PROVIDER");

/**
 * D117/D126 (founder decision) - envelope encryption for gateway secrets:
 * a per-secret data key encrypts the secret itself (AES-256-GCM, the same
 * primitive every other credential type in this codebase already uses -
 * see gateway-credential-vault.service.ts), and THIS interface wraps that
 * data key under an external master key. AwsKmsProvider is the real,
 * production-bound implementation; LocalDevKmsProvider is for dev/test/
 * sandbox only and is refused at boot in production (kms.module.ts's own
 * guard).
 */
export interface KmsProvider {
  /** "aws-kms" | "local-dev" - for logging/audit messages only, never for branching logic outside the two guards that check isProductionSafe. */
  readonly name: string;
  /** False for any provider that must never protect a real production secret (today: LocalDevKmsProvider only). */
  readonly isProductionSafe: boolean;
  /** Generates a fresh, random 256-bit data key. Returns the plaintext (use immediately, never persist it) and its wrapped form (safe to store alongside the secret it will encrypt). */
  generateDataKey(): Promise<{ plaintextKey: Buffer; wrappedKey: string }>;
  /** Unwraps a previously-generated data key back to its plaintext form. */
  unwrapDataKey(wrappedKey: string): Promise<Buffer>;
}
