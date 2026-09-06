import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, ValidateNested } from "class-validator";
import { CartItemDto, MAX_ITEMS_PER_REQUEST } from "./cart-item.dto";

export class UpdateCartDto {
  @IsString()
  hostname!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
