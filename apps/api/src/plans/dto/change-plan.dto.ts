import { IsArray, IsIn, IsOptional, IsUUID } from "class-validator";

export class ChangePlanDto {
  @IsUUID()
  planId!: string;

  // Module 61 (FR-7.20) - which of the three billing cycles to switch to,
  // alongside the tier itself. Omitted keeps the subscription's current
  // cycle unchanged (e.g. a pure tier upgrade with no cycle change).
  @IsOptional()
  @IsIn(["monthly", "six_month", "yearly"])
  billingInterval?: "monthly" | "six_month" | "yearly";

  // Module 66 (SRS §5.6k, FR-6.43) - which store(s) to keep active when
  // this downgrade puts the seller over the new tier's store limit. Omit
  // on the first request; if the response comes back with
  // `requiresStoreChoice: true`, re-submit with this filled in from the
  // confirmation step.
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  keepStoreIds?: string[];
}
