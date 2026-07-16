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
  return validated;
}
