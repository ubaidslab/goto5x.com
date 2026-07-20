import { IsString, MinLength } from "class-validator";

export class StartImpersonationDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
