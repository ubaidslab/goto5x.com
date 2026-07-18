import { Equals, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

export class SignupDto {
  @IsEmail()
  email!: string;

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
}
