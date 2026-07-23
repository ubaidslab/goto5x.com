import { IsOptional, IsString, MaxLength } from "class-validator";

export class DecideApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
