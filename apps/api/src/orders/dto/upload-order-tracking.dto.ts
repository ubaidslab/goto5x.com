import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

/**
 * SRS §5.59/FR-59.3 (b)+(a) - order-level tracking entry: applies the same
 * courier/tracking pair to every not-yet-shipped item on the order, shared
 * by the orders-list inline quick-entry endpoint and the CSV tracking
 * import worker. The existing per-item `UploadTrackingDto` (path (c),
 * unchanged) stays item-scoped for a seller who needs different couriers
 * per item on one order.
 */
export class UploadOrderTrackingDto {
  @IsString()
  @MaxLength(100)
  trackingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  carrier?: string;

  // SRS §5.38/FR-38.7 - see UploadTrackingDto's own field for rationale.
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  trackingUrl?: string;
}
