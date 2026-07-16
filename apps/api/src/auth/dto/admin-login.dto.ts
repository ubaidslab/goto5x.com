import { IsEmail, IsString } from "class-validator";

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class AdminMfaVerifyDto {
  @IsString()
  preAuthToken!: string;

  @IsString()
  code!: string;
}
