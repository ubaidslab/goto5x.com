import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { ScopePermissionDto } from "./scope-permission.dto";

export class CreateStaffAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScopePermissionDto)
  scopePermissions!: ScopePermissionDto[];

  // SRS §5.52/FR-52.10 - optional; omit for an account with no expiry.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
