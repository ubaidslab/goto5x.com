import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
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
