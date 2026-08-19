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

  // Module 61 (FR-7.20) - see create-plan.dto.ts's own notes.
  @IsOptional()
  @IsNumber()
  @Min(0)
  firstCyclePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  campaignPrice?: number;

  @IsOptional()
  @IsBoolean()
  campaignActive?: boolean;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  seatPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(["monthly", "yearly", "none", "six_month"])
  billingInterval?: "monthly" | "yearly" | "none" | "six_month";

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
