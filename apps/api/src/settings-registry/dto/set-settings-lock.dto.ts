import { SettingsScopeType } from "@prisma/client";
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

/** Module 92 (SRS §5.68/FR-68.3). */
export class SetSettingsLockDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsEnum(["global", "plan", "seller", "category", "store", "supplier"])
  scopeType!: SettingsScopeType;

  @IsOptional()
  @IsUUID()
  scopeId?: string;

  @IsBoolean()
  locked!: boolean;
}
