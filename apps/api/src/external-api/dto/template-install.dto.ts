import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

/** FR-24.3 - called by the Template Store's own backend after a seller completes a purchase there. */
export class TemplateInstallDto {
  @IsUUID()
  sellerId!: string;

  @IsString()
  @MaxLength(200)
  themeName!: string;

  @IsString()
  @MaxLength(30)
  themeVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  previewImageUrl?: string;

  /** The Template Store's own reference for the purchase - kept for support/dispute traceability, never interpreted by goto5x.com (FR-24.5). */
  @IsString()
  @MaxLength(200)
  purchaseRef!: string;
}
