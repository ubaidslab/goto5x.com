import { IsOptional, IsUUID, ValidateIf } from "class-validator";

/** FR-66.7 (Module 87) - null clears the thumbnail; omitted is invalid (the client must say which). */
export class SetThumbnailDto {
  @ValidateIf((o) => o.thumbnailMediaId !== null)
  @IsOptional()
  @IsUUID()
  thumbnailMediaId!: string | null;
}
