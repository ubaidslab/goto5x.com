import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;

  // Module 58 (SRS §5.65, FR-65.1/65.2) - advanced SEO fields, Growth+
  // gated (CollectionsService.update() checks seo.advanced_fields_enabled
  // before allowing any field below to be set). No structuredDataEnabled
  // here - collections have no existing JSON-LD to make optional (see
  // Product.structuredDataEnabled's comment).
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
  sitemapIncluded?: boolean;
}
