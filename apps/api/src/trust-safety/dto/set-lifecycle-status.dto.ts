import { IsIn, IsString, MinLength } from "class-validator";

export const LIFECYCLE_STATUSES = ["active", "warned", "restricted", "suspended", "banned"] as const;

export class SetLifecycleStatusDto {
  @IsIn(LIFECYCLE_STATUSES)
  status!: (typeof LIFECYCLE_STATUSES)[number];

  @IsString()
  @MinLength(1)
  reason!: string;
}
