import { IsOptional, IsString, MaxLength } from "class-validator";

export class RestoreProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
