import { Type } from "class-transformer";
import { ArrayMaxSize, IsInt, IsUUID, Max, Min, ValidateNested } from "class-validator";

// No real cart legitimately needs more of either bound; both exist to cap the
// per-request resource amplification (one item lookup/DB round-trip per
// entry) rather than to reflect an actual business rule (P1.4 sweep).
const MAX_QUANTITY_PER_ITEM = 100_000;
export const MAX_ITEMS_PER_REQUEST = 100;

export class CartItemDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}

export class CartItemsDto {
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  @ArrayMaxSize(MAX_ITEMS_PER_REQUEST)
  items!: CartItemDto[];
}
