import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, ValidateNested } from "class-validator";
import { CartItemDto } from "./cart-item.dto";

/**
 * FR-15.1 (locked UX decision) - this is the request that creates the one
 * and only server-side cart row, exactly once the buyer completes the
 * email-first step. There is no earlier "start a cart" endpoint.
 *
 * FR-41.2 (Module 30, v0.30 amendment) - `buyerWhatsapp` is optional here
 * too, captured alongside `buyerEmail` at this same step rather than a
 * second one - abandoned-cart WhatsApp recovery needs it, but it never
 * becomes a required field.
 */
export class CreateCartDto {
  @IsString()
  hostname!: string;

  @IsEmail()
  buyerEmail!: string;

  @IsOptional()
  @IsString()
  buyerWhatsapp?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
