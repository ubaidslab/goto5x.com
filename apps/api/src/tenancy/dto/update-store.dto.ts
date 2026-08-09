import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
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

  // Module 23 (SRS §5.34, FR-34.1) - freeform, shown on the storefront; also
  // the one Store Health Score "profile completeness" input a seller can
  // directly fill in from this same screen.
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  policyText?: string;

  // Module 57 (SRS §5.64, FR-64.1) - optional invoice-customization fields;
  // each renders on generated invoices only when set (FR-64.2).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  invoiceFooterText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  invoiceTermsText?: string;

  // Module 58 (SRS §5.65, FR-65.1/65.5) - store-level defaults the
  // Product/Collection-level toggles fall back to when unset; Growth+
  // gated same as customHeadTags below (StoresService.updateOwn() checks
  // seo.advanced_fields_enabled before allowing any field below to be set).
  @IsOptional()
  @IsBoolean()
  seoRobotsIndexDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  seoRobotsFollowDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  seoStructuredDataDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  seoSitemapIncludedDefault?: boolean;

  // FR-65.4 - sanitized server-side (StoresService.updateOwn()) to an
  // explicit meta/link/script[type=application/ld+json] allowlist before
  // storage; never stored or rendered raw.
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customHeadTags?: string;

  @IsOptional()
  @IsEnum(["public", "coming_soon", "password_protected"])
  accessMode?: StoreAccessMode;

  // Write-only (SRS FR-16.5, Module 5) - StoresService hashes this and
  // never returns it in any response, same discipline as the Google Drive
  // refresh token (Module 2). Required to set accessMode to
  // password_protected if no password has ever been set before.
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  accessPassword?: string;
}
