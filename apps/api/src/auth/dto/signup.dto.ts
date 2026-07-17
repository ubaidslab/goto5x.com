import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

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
}
