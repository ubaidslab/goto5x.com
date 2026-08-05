import { IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, Min, MaxLength } from "class-validator";

/** FR-50.4 - lets the dashboard preview a member count before saving a segment. */
export class PreviewCustomerSegmentDto {
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
