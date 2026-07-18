import { IsString } from "class-validator";

export class MfaVerifyDto {
  @IsString()
  preAuthToken!: string;

  @IsString()
  code!: string;
}
