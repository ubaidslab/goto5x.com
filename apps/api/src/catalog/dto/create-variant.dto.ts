import { IsInt, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateVariantDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
