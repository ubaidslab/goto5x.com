import { Type } from "class-transformer";
import { IsArray, IsString, ValidateNested } from "class-validator";
import { CartItemDto } from "./cart-item.dto";

/**
 * FR-66.4 (Module 84) - surfaces the same flat-rate/free-threshold shipping
 * math checkout already computes, earlier in the buyer journey (product and
 * cart pages), reusing CartItemDto since a single-product quote is just a
 * one-item version of the same shape.
 */
export class ShippingQuoteDto {
  @IsString()
  hostname!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
