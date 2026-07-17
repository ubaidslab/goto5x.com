import { IsNumber, IsOptional, Min } from "class-validator";

export class UpdateShippingSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  flatRate?: number;

  // null clears the threshold (no free-shipping tier); undefined leaves it
  // unchanged - distinguished by the DTO simply omitting the key.
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeShippingThreshold?: number | null;
}
