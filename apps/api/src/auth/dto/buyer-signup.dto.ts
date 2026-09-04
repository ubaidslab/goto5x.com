import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class BuyerSignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;
}
