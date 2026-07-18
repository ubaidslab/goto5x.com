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
}
