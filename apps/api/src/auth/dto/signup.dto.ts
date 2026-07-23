import { Equals, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength, ValidateIf } from "class-validator";

export class SignupDto {
  @IsEmail()
  email!: string;

  // Module 16 (SRS §5.25/FR-25.5) - ISO-3166 alpha-2 code of the applicant's
  // own country, checked against the Settings Registry allowed-countries
  // list for a seller signup only (suppliers are never regionally gated -
  // FR-25.5's text is seller-specific, same scoping as FR-25.6/25.7).
  // Optional, defaulting to "PK" (see AuthService.signup()) - same
  // "optional with a sensible default" shape as `role` above, so every
  // caller that predates this module (and every test not exercising
  // regional gating specifically) is unaffected.
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName!: string;

  // Module 8 (FR-3.1) - a supplier is its own account type, created through
  // this same endpoint rather than a duplicate signup flow. Defaults to
  // "seller" so every pre-Module-8 caller is unaffected.
  @IsOptional()
  @IsIn(["seller", "supplier"])
  role?: "seller" | "supplier";

  // Module 12 (SRS §5.29/FR-29.1) - a seller must accept the current Seller
  // Agreement version at signup. Scoped to sellers only (role defaults to
  // "seller"), not suppliers - FR-29.1's text is seller-specific.
  @ValidateIf((o) => (o.role ?? "seller") === "seller")
  @Equals(true, { message: "You must accept the Seller Agreement to sign up." })
  agreementAccepted?: boolean;

  // Module 12 (SRS §5.30/FR-30.5) - an optional, coarse client-supplied
  // fingerprint, a risk-score input only, never security-critical by
  // itself.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceFingerprint?: string;

  // SRS §5.33/FR-33.1 - captured once, at signup, since it can never be
  // backfilled. Loosely validated here (length only) - shape/format
  // validation happens in resolveReferralSource(), which never blocks
  // signup on a bad code, only nulls it.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string;
}
