import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: "slug must be 3-63 lowercase letters, numbers, or hyphens",
  })
  slug!: string;

  // SRS §5.70/FR-70.2 - optional (falls back to the schema's "PKR" default
  // when omitted). Checked against the founder-editable
  // stores.supported_currencies allowlist in StoresService.create(), not a
  // compile-time @IsIn() here, since that list can change without a
  // deploy. Deliberately absent from UpdateStoreDto - changing a store's
  // currency after it has live orders is a data-integrity hazard (new
  // orders would use the new currency while historical orders keep their
  // old one), so this is a creation-time-only choice with no edit path yet.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: "currency must be a 3-letter ISO-4217 code" })
  currency?: string;
}
