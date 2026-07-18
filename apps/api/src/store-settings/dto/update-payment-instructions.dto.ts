import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePaymentInstructionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  jazzcashNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  easypaisaNumber?: string;

  @IsOptional()
  @IsBoolean()
  codEnabled?: boolean;

  // Module 12 (SRS §5.30, FR-30.2) - per-instrument declared account title
  // for JazzCash/Easypaisa (the bank instrument already had one), plus one
  // shared ownership checkbox covering whichever instruments are filled in.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jazzcashAccountTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  easypaisaAccountTitle?: string;

  @IsOptional()
  @IsBoolean()
  nameDeclaredSelfOwned?: boolean;
}
