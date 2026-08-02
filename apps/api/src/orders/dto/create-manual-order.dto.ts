import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, ValidateNested } from "class-validator";
import { CartItemDto } from "./cart-item.dto";
import { ShippingAddressDto } from "./shipping-address.dto";

/**
 * FR-17.1 - a seller creating an order directly from the dashboard (phone/
 * WhatsApp selling). Produces the same order/order-item shape as a
 * storefront checkout (CheckoutService.buildOrder(), shared) - only
 * `source` differs.
 */
export class CreateManualOrderDto {
  @IsEmail()
  buyerEmail!: string;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];

  @IsOptional()
  @IsString()
  discountCode?: string;

  /** FR-37.1 - only meaningful when the store's verification channel is whatsapp_otp. */
  @IsOptional()
  @IsString()
  buyerWhatsapp?: string;
}
