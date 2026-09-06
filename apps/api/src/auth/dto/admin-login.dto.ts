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

/** P1.4 input-validation sweep fix - previously an untyped @Body() object literal bypassed the global ValidationPipe entirely. */
export class AdminMfaEnrollDto {
  @IsString()
  preAuthToken!: string;
}
