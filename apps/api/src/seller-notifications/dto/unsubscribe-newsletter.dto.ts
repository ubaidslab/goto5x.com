import { IsString, MinLength } from "class-validator";

export class UnsubscribeNewsletterDto {
  @IsString()
  @MinLength(1)
  token!: string;
}
