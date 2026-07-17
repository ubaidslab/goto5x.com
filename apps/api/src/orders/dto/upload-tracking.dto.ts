import { IsOptional, IsString, MaxLength } from "class-validator";

export class UploadTrackingDto {
  @IsString()
  @MaxLength(100)
  trackingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  carrier?: string;
}
