import { IsUUID } from "class-validator";

export class WishlistItemDto {
  @IsUUID()
  productId!: string;
}
