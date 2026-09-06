/**
 * P1.4 input-validation sweep - every money-amount column in this schema is
 * Decimal(12,2) (prisma/schema.prisma). A value beyond this range previously
 * reached Postgres and failed as an unhandled 500 (numeric field overflow)
 * instead of a clean 400 from the ValidationPipe; DTOs that accept a raw
 * money amount from a request body should pair @Max(MAX_MONEY_VALUE) with
 * their existing @IsPositive()/@Min(0).
 */
export const MAX_MONEY_VALUE = 9999999999.99;
