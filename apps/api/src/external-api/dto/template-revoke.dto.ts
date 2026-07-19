import { IsString, IsUUID, MaxLength } from "class-validator";

/** FR-24.6 - a refunded Template Store purchase revokes the entitlement; the `themes` catalog entry itself is never touched. */
export class TemplateRevokeDto {
  @IsUUID()
  sellerId!: string;

  @IsString()
  @MaxLength(200)
  themeName!: string;

  @IsString()
  @MaxLength(30)
  themeVersion!: string;
}
