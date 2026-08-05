import { IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, Min, MaxLength } from "class-validator";

/** FR-50.1 - a saved filter; every dimension is optional (an empty segment matches every customer). */
export class CreateCustomerSegmentDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrders?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxOrders?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  minTotalSpent?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxTotalSpent?: number;

  @IsOptional()
  @IsISO8601()
  lastOrderAfter?: string;

  @IsOptional()
  @IsISO8601()
  lastOrderBefore?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCountry?: string;
}
