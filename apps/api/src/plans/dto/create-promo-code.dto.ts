import { IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from "class-validator";
import { $Enums } from "@prisma/client";

export class CreatePromoCodeDto {
  @IsString()
  code!: string;

  @IsEnum($Enums.PromoDiscountType)
  discountType!: $Enums.PromoDiscountType;

  @IsNumber()
  @IsPositive()
  discountValue!: number;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
