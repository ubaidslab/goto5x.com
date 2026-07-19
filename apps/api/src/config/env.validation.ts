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

  @IsString()
  ADMIN_MFA_ISSUER_NAME!: string;

  @IsString()
  APP_BASE_URL!: string;

  @IsIn(["console", "resend", "ses"])
  EMAIL_PROVIDER!: string;

  @IsOptional()
  @IsString()
  EMAIL_PROVIDER_API_KEY?: string;

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

  @IsString()
  GOOGLE_DRIVE_CLIENT_ID!: string;

  @IsString()
  GOOGLE_DRIVE_CLIENT_SECRET!: string;

  @IsString()
  GOOGLE_DRIVE_REDIRECT_URI!: string;

  @IsString()
  DRIVE_TOKEN_ENCRYPTION_KEY!: string;

  @IsString()
  TRAEFIK_DYNAMIC_CONFIG_DIR!: string;

  @IsString()
  PRINTIFY_API_KEY!: string;

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
  return validated;
}
