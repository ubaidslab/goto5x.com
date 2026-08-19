import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";
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

  // v0.33/FR-7.19 - the struck-through "was" price shown beside `price` on
  // the plan editor and public pricing page. Optional - a tier with no
  // regular/discounted distinction simply omits it.
  @IsOptional()
  @IsNumber()
  @Min(0)
  regularPrice?: number;

  // Module 61 (FR-7.20) - a one-time discount for the subscription's very
  // first billing cycle only.
  @IsOptional()
  @IsNumber()
  @Min(0)
  firstCyclePrice?: number;

  // Module 61 (FR-7.20) - a second, separately-toggleable discounted
  // price for a time-boxed campaign; see campaignActive below.
  @IsOptional()
  @IsNumber()
  @Min(0)
  campaignPrice?: number;

  @IsOptional()
  @IsBoolean()
  campaignActive?: boolean;

  // FR-7.18 - only meaningful for planGroup = "team"; PlansService rejects
  // it otherwise.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  seatPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsIn(["monthly", "yearly", "none", "six_month"])
  billingInterval!: "monthly" | "yearly" | "none" | "six_month";

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyDiscountPercent?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
