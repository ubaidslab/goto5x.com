import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { ProductStatus } from "@prisma/client";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

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

  /** SRS §5.57/FR-57.1 - replaces the full tag set (not a merge/append). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  tags?: string[];

  // Module 58 (SRS §5.65, FR-65.1-65.3) - advanced SEO fields, Growth+
  // gated (ProductsService.update() checks seo.advanced_fields_enabled
  // before allowing any field below to be set).
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  canonicalUrl?: string;

  @IsOptional()
  @IsBoolean()
  robotsIndex?: boolean;

  @IsOptional()
  @IsBoolean()
  robotsFollow?: boolean;

  @IsOptional()
  @IsUUID()
  ogImageMediaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  ogTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  ogDescription?: string;

  @IsOptional()
  @IsBoolean()
  structuredDataEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sitemapIncluded?: boolean;

  // FR-65.3 - same pattern as the existing Collection.slug convention
  // (CreateCollectionDto).
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,63}$/, { message: "slug must be 1-63 lowercase letters, numbers, or hyphens" })
  slug?: string;
}
