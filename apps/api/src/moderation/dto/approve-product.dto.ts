import { IsOptional, IsString, MaxLength } from "class-validator";

export class ApproveProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
