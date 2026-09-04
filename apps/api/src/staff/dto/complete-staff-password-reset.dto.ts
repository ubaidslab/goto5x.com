import { IsString, MaxLength, MinLength } from "class-validator";

export class CompleteStaffPasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  newPassword!: string;
}
