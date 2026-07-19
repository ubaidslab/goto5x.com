import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/** FR-8.14 - the toggle admin uses to disable a misbehaving/compromised integration without a deploy. */
export class UpdateExternalApiClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
