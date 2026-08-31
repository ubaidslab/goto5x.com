import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class SupplierUploadTrackingDto {
  @IsString()
  @MaxLength(100)
  trackingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  carrier?: string;

  // SRS §5.38/FR-38.7 - see orders/dto/upload-tracking.dto.ts's own field for rationale.
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  trackingUrl?: string;
}
