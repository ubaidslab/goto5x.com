import { Type } from "class-transformer";
import { IsInt, IsUUID, Min, ValidateNested } from "class-validator";

export class CartItemDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CartItemsDto {
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}
