import { IsEnum } from "class-validator";
import { StaffPermission, StaffScope } from "@prisma/client";

/** SRS §5.52/FR-52.8 - one granted scope + its permission level. */
export class ScopePermissionDto {
  @IsEnum(StaffScope)
  scope!: StaffScope;

  @IsEnum(StaffPermission)
  permission!: StaffPermission;
}
