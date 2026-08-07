import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateVariantDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
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
  baseCost?: number;
}
