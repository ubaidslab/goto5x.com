import { IsDateString, IsString, MinLength } from "class-validator";

export class SuspendStaffAccountDto {
  @IsDateString()
  until!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
