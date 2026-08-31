import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsOptional, ValidateIf, ValidateNested } from "class-validator";
import { ScopePermissionDto } from "./scope-permission.dto";

/** SRS §5.52/FR-52.9 - "a template is a starting point, never a locked role": every field here stays freely editable post-creation. */
export class UpdateStaffAccountDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScopePermissionDto)
  scopePermissions?: ScopePermissionDto[];

  @IsOptional()
  @ValidateIf((o) => o.expiresAt !== null)
  @IsDateString()
  expiresAt?: string | null;

  // SRS §5.52/FR-52.12 - RISE+ only; the service checks the seller's plan
  // tier before allowing this to be set to true.
  @IsOptional()
  @IsBoolean()
  deviceRestrictionEnabled?: boolean;
}
