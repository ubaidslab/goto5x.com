import { DiscountType } from "@prisma/client";
import { IsEnum, IsISO8601, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { MAX_MONEY_VALUE } from "../../common/validation/money.constants";

export class CreateDiscountCodeDto {
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: "code may only contain letters, numbers, underscores, and hyphens" })
  code!: string;

  @IsEnum(DiscountType)
  type!: DiscountType;

  // A `percentage` type additionally can't exceed 100 - checked in
  // DiscountCodesService, not here, since it's a cross-field business rule
  // rather than a shape constraint.
  @IsNumber()
  @IsPositive()
  @Max(MAX_MONEY_VALUE)
  value!: number;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}
