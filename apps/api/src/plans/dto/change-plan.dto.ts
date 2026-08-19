import { IsIn, IsOptional, IsUUID } from "class-validator";

export class ChangePlanDto {
  @IsUUID()
  planId!: string;

  // Module 61 (FR-7.20) - which of the three billing cycles to switch to,
  // alongside the tier itself. Omitted keeps the subscription's current
  // cycle unchanged (e.g. a pure tier upgrade with no cycle change).
  @IsOptional()
  @IsIn(["monthly", "six_month", "yearly"])
  billingInterval?: "monthly" | "six_month" | "yearly";
}
