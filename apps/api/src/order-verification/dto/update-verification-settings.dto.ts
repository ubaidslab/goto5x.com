import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const CHANNELS = ["none", "whatsapp_otp", "email_otp", "prepaid_confirmation"] as const;

/** FR-37.1/FR-37.6 - the seller's own choice of channel, plus their own OTP message wording. */
export class UpdateVerificationSettingsDto {
  @IsIn(CHANNELS)
  channel!: (typeof CHANNELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  messageTemplate?: string;
}
