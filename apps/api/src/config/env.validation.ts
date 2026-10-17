import { plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsIn(["development", "test", "production"])
  NODE_ENV!: string;

  @IsInt()
  @Min(1)
  PORT!: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DATABASE_ADMIN_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsInt()
  @Min(1)
  JWT_ACCESS_TTL_MINUTES!: number;

  @IsInt()
  @Min(1)
  JWT_REFRESH_TTL_DAYS!: number;

  // D82 - admin sessions hold BYPASSRLS access, the highest-value
  // compromise target in this codebase (SessionService's own refresh-
  // reuse-detection comment already says as much) - an admin's refresh
  // session/cookie defaults to a much shorter lifetime than the seller
  // default above (ADMIN_DEFAULT_REFRESH_TTL_DAYS in admin-auth.service.ts
  // when this is unset), forcing a full password+TOTP re-login far more
  // often. Optional, not required: every existing deployment/CI env
  // keeps working unchanged, and this exists as an override for the
  // already-strict default, not the switch that enables stricter
  // behavior in the first place.
  @IsOptional()
  @IsInt()
  @Min(1)
  ADMIN_JWT_REFRESH_TTL_DAYS?: number;

  @IsString()
  ADMIN_MFA_ISSUER_NAME!: string;

  @IsString()
  APP_BASE_URL!: string;

  @IsIn(["console", "resend", "ses"])
  EMAIL_PROVIDER!: string;

  @IsOptional()
  @IsString()
  EMAIL_PROVIDER_API_KEY?: string;

  // D116 item 6 (Stage 0) - optional, same "loudly skipped_not_configured,
  // never a required secret" discipline as BACKUP_S3_* below: a missing
  // DSN just means error tracking never initializes, not a boot failure.
  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsString()
  EMAIL_FROM_ADDRESS!: string;

  @IsString()
  MINIO_ENDPOINT!: string;

  @IsString()
  MINIO_ROOT_USER!: string;

  @IsString()
  MINIO_ROOT_PASSWORD!: string;

  @IsString()
  MINIO_BUCKET!: string;

  @IsOptional()
  @IsString()
  MEDIA_PUBLIC_BASE_URL?: string;

  // D126 (founder decision, Stage 0 beta) - optional graceful degradation,
  // same "skipped_not_configured, never a required secret" discipline as
  // SENTRY_DSN/BACKUP_S3_* above: the first 5-10 beta sellers never touch
  // Drive import, so a missing credential just means
  // GoogleDriveClientService.isConfigured() is false and DriveController
  // answers every Drive-touching request with a 503 instead of failing boot.
  @IsOptional()
  @IsString()
  GOOGLE_DRIVE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_DRIVE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GOOGLE_DRIVE_REDIRECT_URI?: string;

  @IsString()
  DRIVE_TOKEN_ENCRYPTION_KEY!: string;

  @IsString()
  TRAEFIK_DYNAMIC_CONFIG_DIR!: string;

  // D126 (founder decision, Stage 0 beta) - optional graceful degradation,
  // same discipline as GOOGLE_DRIVE_* above: a missing key just means
  // PrintifyHttpClient.isConfigured() is false and the Printify dropshipping
  // adapter is unavailable rather than a boot failure.
  @IsOptional()
  @IsString()
  PRINTIFY_API_KEY?: string;

  @IsOptional()
  @IsString()
  CORS_ALLOWED_ORIGINS?: string;

  // Module 12 (FR-30.1) - CNIC encryption at rest, same AES-256-GCM
  // mechanism/key-management discipline as DRIVE_TOKEN_ENCRYPTION_KEY, kept
  // as its own key (not reused) so the two secrets can be rotated
  // independently.
  @IsString()
  IDENTITY_ENCRYPTION_KEY!: string;

  // Module 12 (FR-30.1/FR-30.3) - HMAC key for the CNIC/payment-instrument
  // uniqueness fingerprints. Deliberately a keyed hash, not a plain SHA-256,
  // so the fingerprint can't be reversed via a dictionary/rainbow-table
  // attack against the (small, guessable) space of 13-digit CNICs or
  // 10-11-digit account numbers.
  @IsString()
  IDENTITY_FINGERPRINT_HMAC_SECRET!: string;

  // Module 18 (SRS §5.24/§6.5) - encrypts each ExternalApiClient's HMAC
  // signing secret at rest, same AES-256-GCM mechanism/key-management
  // discipline as DRIVE_TOKEN_ENCRYPTION_KEY/IDENTITY_ENCRYPTION_KEY, kept
  // as its own key so all three secrets rotate independently.
  @IsString()
  EXTERNAL_API_SECRET_ENCRYPTION_KEY!: string;

  // Module 26 (SRS §5.37/FR-37.3) - encrypts a seller's connected SMTP
  // password at rest, same AES-256-GCM mechanism/key-management discipline
  // as DRIVE_TOKEN_ENCRYPTION_KEY/IDENTITY_ENCRYPTION_KEY/
  // EXTERNAL_API_SECRET_ENCRYPTION_KEY, kept as its own key so all four
  // secrets rotate independently.
  @IsString()
  SMTP_CREDENTIAL_ENCRYPTION_KEY!: string;

  // Module 36 (SRS §5.53/FR-53.2) - encrypts a linked admin email
  // account's IMAP+SMTP passwords at rest, same AES-256-GCM mechanism/
  // key-management discipline as DRIVE_TOKEN_ENCRYPTION_KEY/
  // IDENTITY_ENCRYPTION_KEY/EXTERNAL_API_SECRET_ENCRYPTION_KEY/
  // SMTP_CREDENTIAL_ENCRYPTION_KEY, kept as its own key so all five
  // secrets rotate independently.
  @IsString()
  ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY!: string;

  // Module 62 (SRS §5.6h/FR-6.36) - encrypts a seller's connected payment-
  // gateway API key/secret at rest, same AES-256-GCM mechanism/key-
  // management discipline as every other *_ENCRYPTION_KEY above, kept as
  // its own key so this secret rotates independently.
  @IsString()
  PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY!: string;

  // D117/D126 (founder decision) - envelope encryption for gateway
  // secrets (kms.module.ts). Optional at this global-schema level because
  // which of the fields below is actually required depends on this
  // value: "local-dev" (the default when unset) needs
  // LOCAL_DEV_KMS_MASTER_KEY; "aws" needs AWS_KMS_KEY_ID/AWS_REGION. Each
  // KmsProvider's own constructor enforces what IT needs via
  // getOrThrow() - kms.module.ts's boot guard is what actually prevents
  // local-dev from running in production, not this schema.
  @IsOptional()
  @IsIn(["aws", "local-dev"])
  KMS_PROVIDER_TYPE?: string;

  @IsOptional()
  @IsString()
  LOCAL_DEV_KMS_MASTER_KEY?: string;

  @IsOptional()
  @IsString()
  AWS_KMS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  AWS_REGION?: string;

  // Only ever set in CI, to point AwsKmsProvider at a LocalStack KMS
  // emulator instead of real AWS (.github/workflows/ci.yml's
  // kms-localstack-test job) - unset in every real environment.
  @IsOptional()
  @IsString()
  AWS_KMS_ENDPOINT?: string;

  // B2 (founder decision, sandbox only) - only ever set in CI, to point
  // StripeGatewayAdapter at stripe-mock instead of real Stripe
  // (.github/workflows/ci.yml's stripe-mock-test job) - same precedent
  // as AWS_KMS_ENDPOINT above. Unset in every real environment; a
  // store's own Stripe restricted key (StorePaymentGatewayConnection,
  // via the gateway-credential vault) is the only credential this
  // adapter ever needs for real Stripe.
  @IsOptional()
  @IsString()
  STRIPE_API_HOST?: string;

  @IsOptional()
  @IsString()
  STRIPE_API_PROTOCOL?: string;
}

/**
 * Fails fast at boot if a required env var is missing or malformed, rather
 * than starting in a broken state (SRS build-plan.md, Module 1 test list).
 */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(", "))
        .join("\n")}`,
    );
  }
  // class-validator has no built-in "decoded byte length" check, so this one
  // is verified by hand rather than pulling in a custom-validator class for a
  // single field: AES-256-GCM needs exactly a 32-byte key.
  if (Buffer.from(validated.DRIVE_TOKEN_ENCRYPTION_KEY, "base64").length !== 32) {
    throw new Error(
      "Invalid environment configuration:\nDRIVE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)",
    );
  }
  if (Buffer.from(validated.IDENTITY_ENCRYPTION_KEY, "base64").length !== 32) {
    throw new Error(
      "Invalid environment configuration:\nIDENTITY_ENCRYPTION_KEY must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)",
    );
  }
  if (Buffer.from(validated.EXTERNAL_API_SECRET_ENCRYPTION_KEY, "base64").length !== 32) {
    throw new Error(
      "Invalid environment configuration:\nEXTERNAL_API_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)",
    );
  }
  if (Buffer.from(validated.SMTP_CREDENTIAL_ENCRYPTION_KEY, "base64").length !== 32) {
    throw new Error(
      "Invalid environment configuration:\nSMTP_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)",
    );
  }
  if (Buffer.from(validated.ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY, "base64").length !== 32) {
    throw new Error(
      "Invalid environment configuration:\nADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)",
    );
  }
  if (Buffer.from(validated.PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY, "base64").length !== 32) {
    throw new Error(
      "Invalid environment configuration:\nPAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)",
    );
  }
  // Unlike the keys above, this one is optional at the schema level (only
  // local-dev's own KmsProvider needs it) - only checked when actually set.
  if (validated.LOCAL_DEV_KMS_MASTER_KEY && Buffer.from(validated.LOCAL_DEV_KMS_MASTER_KEY, "base64").length !== 32) {
    throw new Error(
      "Invalid environment configuration:\nLOCAL_DEV_KMS_MASTER_KEY must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)",
    );
  }
  return validated;
}
