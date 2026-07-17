import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEmail, IsString, ValidateNested } from "class-validator";
import { CartItemDto } from "./cart-item.dto";

/**
 * FR-15.1 (locked UX decision) - this is the request that creates the one
 * and only server-side cart row, exactly once the buyer completes the
 * email-first step. There is no earlier "start a cart" endpoint.
 */
export class CreateCartDto {
  @IsString()
  hostname!: string;

  @IsEmail()
  buyerEmail!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
