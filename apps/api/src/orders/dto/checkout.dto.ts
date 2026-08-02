import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { ShippingAddressDto } from "./shipping-address.dto";

export class CheckoutDto {
  @IsString()
  hostname!: string;

  @IsString()
  sessionToken!: string;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsOptional()
  @IsString()
  discountCode?: string;

  /** FR-37.1 - only meaningful when the store's verification channel is whatsapp_otp. */
  @IsOptional()
  @IsString()
  buyerWhatsapp?: string;
}
