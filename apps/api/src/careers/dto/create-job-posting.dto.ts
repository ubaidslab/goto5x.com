import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateJobPostingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  role!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;
}
