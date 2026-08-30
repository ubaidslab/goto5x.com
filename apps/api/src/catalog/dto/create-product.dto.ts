import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ProductStatus } from "@prisma/client";
import { ProductCustomAttributeDto } from "./product-custom-attribute.dto";

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(["draft", "active", "archived"])
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;

  /** SRS §5.57/FR-57.1 - free-form seller-defined tags, dashboard-private by default. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags?: string[];

  /** SRS §5.69/FR-69.1 - replaces the full set (not a merge/append), same convention as `tags` above. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductCustomAttributeDto)
  customAttributes?: ProductCustomAttributeDto[];
}
