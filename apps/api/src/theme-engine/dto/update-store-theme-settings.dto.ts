import { IsObject, IsOptional, IsString, IsUUID } from "class-validator";

export class UpdateStoreThemeSettingsDto {
  @IsOptional()
  @IsUUID()
  themeId?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  // Gated by the `theme.coded_mode_enabled` Settings Registry key (FR-1.6) -
  // see StoreThemeSettingsService.update().
  @IsOptional()
  @IsString()
  customCode?: string;
}
