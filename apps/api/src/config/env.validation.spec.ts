import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const validConfig = {
    NODE_ENV: "test",
    PORT: 3000,
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    DATABASE_ADMIN_URL: "postgresql://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "secret",
    JWT_ACCESS_TTL_MINUTES: 15,
    JWT_REFRESH_TTL_DAYS: 30,
    ADMIN_MFA_ISSUER_NAME: "uzeyn.com",
    APP_BASE_URL: "http://localhost:3001",
    EMAIL_PROVIDER: "console",
    EMAIL_FROM_ADDRESS: "no-reply@uzeyn.com",
    MINIO_ENDPOINT: "http://localhost:9000",
    MINIO_ROOT_USER: "uzeyn-minio",
    MINIO_ROOT_PASSWORD: "minio-secret",
    MINIO_BUCKET: "uzeyn-media",
    GOOGLE_DRIVE_CLIENT_ID: "client-id",
    GOOGLE_DRIVE_CLIENT_SECRET: "client-secret",
    GOOGLE_DRIVE_REDIRECT_URI: "http://localhost:3000/media/drive/callback",
    DRIVE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    TRAEFIK_DYNAMIC_CONFIG_DIR: "/tmp/traefik-dynamic-test",
    PRINTIFY_API_KEY: "printify-test-key",
    IDENTITY_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
    IDENTITY_FINGERPRINT_HMAC_SECRET: "identity-fingerprint-test-secret",
    EXTERNAL_API_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64"),
    SMTP_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString("base64"),
    ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 13).toString("base64"),
    PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64"),
  };

  it("passes through a fully-populated, valid config", () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it("passes when GOOGLE_DRIVE_*/PRINTIFY_API_KEY are entirely absent (D126 - Stage 0 graceful degradation)", () => {
    const {
      GOOGLE_DRIVE_CLIENT_ID: _GOOGLE_DRIVE_CLIENT_ID,
      GOOGLE_DRIVE_CLIENT_SECRET: _GOOGLE_DRIVE_CLIENT_SECRET,
      GOOGLE_DRIVE_REDIRECT_URI: _GOOGLE_DRIVE_REDIRECT_URI,
      PRINTIFY_API_KEY: _PRINTIFY_API_KEY,
      ...withoutOptionalIntegrations
    } = validConfig;
    expect(() => validateEnv(withoutOptionalIntegrations)).not.toThrow();
  });

  it("throws when a required variable is missing entirely", () => {
    const { DATABASE_URL: _DATABASE_URL, ...missingDbUrl } = validConfig;
    expect(() => validateEnv(missingDbUrl)).toThrow();
  });

  it("throws when NODE_ENV has a value outside the allowed set", () => {
    expect(() => validateEnv({ ...validConfig, NODE_ENV: "not-a-real-env" })).toThrow();
  });

  it("throws when EMAIL_PROVIDER has a value outside the allowed set", () => {
    expect(() => validateEnv({ ...validConfig, EMAIL_PROVIDER: "carrier-pigeon" })).toThrow();
  });

  it("throws when DRIVE_TOKEN_ENCRYPTION_KEY does not decode to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, DRIVE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") }),
    ).toThrow(/32-byte key/);
  });

  it("passes when DRIVE_TOKEN_ENCRYPTION_KEY decodes to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, DRIVE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") }),
    ).not.toThrow();
  });

  it("throws when IDENTITY_ENCRYPTION_KEY does not decode to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, IDENTITY_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") }),
    ).toThrow(/32-byte key/);
  });

  it("passes when IDENTITY_ENCRYPTION_KEY decodes to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, IDENTITY_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") }),
    ).not.toThrow();
  });

  it("throws when EXTERNAL_API_SECRET_ENCRYPTION_KEY does not decode to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, EXTERNAL_API_SECRET_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") }),
    ).toThrow(/32-byte key/);
  });

  it("passes when EXTERNAL_API_SECRET_ENCRYPTION_KEY decodes to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, EXTERNAL_API_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") }),
    ).not.toThrow();
  });

  it("throws when ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY does not decode to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") }),
    ).toThrow(/32-byte key/);
  });

  it("passes when ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY decodes to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") }),
    ).not.toThrow();
  });

  it("throws when PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY does not decode to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64"),
      }),
    ).toThrow(/32-byte key/);
  });

  it("passes when PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY decodes to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 21).toString("base64"),
      }),
    ).not.toThrow();
  });

  it("passes when KMS_PROVIDER_TYPE/LOCAL_DEV_KMS_MASTER_KEY/AWS_KMS_* are entirely absent (D117/D126 - kms.module.ts's own default/guard, not this schema, decides what's required)", () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it("passes when STRIPE_API_HOST/STRIPE_API_PROTOCOL are absent (B2 - CI-only stripe-mock override, never required in a real environment)", () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
    expect(() => validateEnv({ ...validConfig, STRIPE_API_HOST: "localhost:12111", STRIPE_API_PROTOCOL: "http" })).not.toThrow();
  });

  it("throws when KMS_PROVIDER_TYPE has a value outside the allowed set", () => {
    expect(() => validateEnv({ ...validConfig, KMS_PROVIDER_TYPE: "self-hosted-vault" })).toThrow();
  });

  it("throws when LOCAL_DEV_KMS_MASTER_KEY is set but does not decode to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, LOCAL_DEV_KMS_MASTER_KEY: Buffer.alloc(16, 1).toString("base64") }),
    ).toThrow(/32-byte key/);
  });

  it("passes when LOCAL_DEV_KMS_MASTER_KEY decodes to exactly 32 bytes", () => {
    expect(() =>
      validateEnv({ ...validConfig, LOCAL_DEV_KMS_MASTER_KEY: Buffer.alloc(32, 19).toString("base64") }),
    ).not.toThrow();
  });
});
