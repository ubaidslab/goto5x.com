import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** SRS §5.38/FR-38.8-38.9 - a seller's editable buyer-facing tracking messages + the delivered-archival window, all in one PATCH. */
export class UpdateDeliveryTrackingSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  messagePending?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageSubmitted?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageDelivered?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageCancelled?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  archiveDays?: number;
}
