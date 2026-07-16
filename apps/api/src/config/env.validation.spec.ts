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
    ADMIN_MFA_ISSUER_NAME: "goto5x.com",
    APP_BASE_URL: "http://localhost:3001",
    EMAIL_PROVIDER: "console",
    EMAIL_FROM_ADDRESS: "no-reply@goto5x.com",
  };

  it("passes through a fully-populated, valid config", () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it("throws when a required variable is missing entirely", () => {
    const { DATABASE_URL, ...missingDbUrl } = validConfig;
    expect(() => validateEnv(missingDbUrl)).toThrow();
  });

  it("throws when NODE_ENV has a value outside the allowed set", () => {
    expect(() => validateEnv({ ...validConfig, NODE_ENV: "not-a-real-env" })).toThrow();
  });

  it("throws when EMAIL_PROVIDER has a value outside the allowed set", () => {
    expect(() => validateEnv({ ...validConfig, EMAIL_PROVIDER: "carrier-pigeon" })).toThrow();
  });
});
