import { IsString } from "class-validator";

export class MfaVerifyCodeDto {
  @IsString()
  code!: string;
}
