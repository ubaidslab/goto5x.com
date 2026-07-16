import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ProductStatus } from "@prisma/client";

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
}
