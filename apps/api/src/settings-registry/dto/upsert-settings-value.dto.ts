import { SettingsScopeType } from "@prisma/client";
import { IsDefined, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class UpsertSettingsValueDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsEnum(["global", "plan", "seller", "category", "store"])
  scopeType!: SettingsScopeType;

  @IsOptional()
  @IsUUID()
  scopeId?: string;

  // @IsDefined() (not a type-specific check, since the shape depends on the
  // definition's valueType) is required here, not decorative: NestJS's
  // global ValidationPipe runs with `whitelist: true`, which strips any
  // property with NO class-validator decorator at all, even if it's declared
  // on the DTO class - caught by an e2e test where `value` silently became
  // `undefined` before reaching the settings service. @IsDefined() is enough
  // to keep the property without over-constraining its type.
  @IsDefined()
  value: unknown;
}
