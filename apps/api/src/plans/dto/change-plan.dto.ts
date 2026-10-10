import { IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";

export class ChangePlanDto {
  @IsUUID()
  planId!: string;

  // Module 61 (FR-7.20) - which billing cycle to switch to, alongside the
  // tier itself. Omitted keeps the subscription's current cycle unchanged
  // (e.g. a pure tier upgrade with no cycle change). B2 (2026-10-10, D10)
  // added `quarterly` to the three original cycles.
  @IsOptional()
  @IsIn(["monthly", "quarterly", "six_month", "yearly"])
  billingInterval?: "monthly" | "quarterly" | "six_month" | "yearly";

  // Module 66 (SRS §5.6k, FR-6.43) - which store(s) to keep active when
  // this downgrade puts the seller over the new tier's store limit. Omit
  // on the first request; if the response comes back with
  // `requiresStoreChoice: true`, re-submit with this filled in from the
  // confirmation step.
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  keepStoreIds?: string[];

  // FR-6.69 (Module 102) - explicit re-submission after the seller has seen
  // a requiresDowngradeConfirmation response's loss list. Omitted (or
  // false) on the first request; a downgrade with no losses never requires
  // this at all.
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}
