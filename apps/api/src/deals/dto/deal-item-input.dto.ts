import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class DealItemInputDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  variantId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
