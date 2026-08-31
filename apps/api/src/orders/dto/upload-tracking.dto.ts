import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UploadTrackingDto {
  @IsString()
  @MaxLength(100)
  trackingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  carrier?: string;

  // SRS §5.38/FR-38.7 - the courier's own tracking-page link, shown
  // alongside the tracking ID on the buyer's simplified status page.
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  trackingUrl?: string;
}
