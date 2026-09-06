import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { MAX_MONEY_VALUE } from "../../common/validation/money.constants";

export class CreateVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY_VALUE)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY_VALUE)
  compareAtPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stockQuantity?: number;

  /** Module 46 (SRS §5.39, FR-39.5) - defaults true (oversell-protected) if omitted; a seller sets false for untracked/unlimited stock. */
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  /** Module 31 (SRS §5.42/FR-42.1) - optional COGS input for the P&L engine. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY_VALUE)
  baseCost?: number;
}
