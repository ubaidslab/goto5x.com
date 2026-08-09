import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreatePlatformNewsletterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}
