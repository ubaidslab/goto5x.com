import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";
import { $Enums } from "@prisma/client";

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsEnum($Enums.PlanGroup)
  planGroup!: $Enums.PlanGroup;

  @IsOptional()
  @IsInt()
  @Min(0)
  tierOrder?: number;

  @IsNumber()
  @Min(0)
  price!: number;

  // FR-7.18 - only meaningful for planGroup = "team"; PlansService rejects
  // it otherwise.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  seatPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsIn(["monthly", "yearly", "none"])
  billingInterval!: "monthly" | "yearly" | "none";

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyDiscountPercent?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
