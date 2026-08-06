import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  tierOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  // v0.33/FR-7.19 - see create-plan.dto.ts's own note.
  @IsOptional()
  @IsNumber()
  @Min(0)
  regularPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  seatPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(["monthly", "yearly", "none"])
  billingInterval?: "monthly" | "yearly" | "none";

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyDiscountPercent?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
