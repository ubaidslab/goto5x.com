import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ApplyJobDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  applicantName!: string;

  @IsEmail()
  applicantEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  applicantPhone?: string;
}
