import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class AddCollectionProductDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
