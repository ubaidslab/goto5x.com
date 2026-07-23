import { IsOptional, IsString, MaxLength } from "class-validator";

export class VerifyContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
