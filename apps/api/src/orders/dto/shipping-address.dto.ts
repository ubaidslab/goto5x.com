import { IsOptional, IsString, Length, MaxLength } from "class-validator";

export class ShippingAddressDto {
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MaxLength(240)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  line2?: string;

  @IsString()
  @MaxLength(120)
  city!: string;

  /** ISO 3166-1 alpha-2 - checked against a supplier listing's supportedCountries (FR-4.7). */
  @IsString()
  @Length(2, 2)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsString()
  @MaxLength(30)
  phone!: string;
}
