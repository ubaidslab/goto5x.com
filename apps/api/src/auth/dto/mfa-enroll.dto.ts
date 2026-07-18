import { IsString } from "class-validator";

export class MfaEnrollDto {
  @IsString()
  preAuthToken!: string;
}
