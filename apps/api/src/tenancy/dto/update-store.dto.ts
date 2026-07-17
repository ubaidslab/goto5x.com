import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { StoreAccessMode } from "@prisma/client";

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;

  // Only the column + storefront noindex/sitemap read-side behavior are
  // Module 4 scope (SRS FR-1.5, v0.9). The coming-soon page content and
  // password-gate flow themselves are Module 5's job (FR-16.5, §14.16).
  @IsOptional()
  @IsEnum(["public", "coming_soon", "password_protected"])
  accessMode?: StoreAccessMode;
}
