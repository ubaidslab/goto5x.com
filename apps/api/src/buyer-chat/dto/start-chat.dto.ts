import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class StartChatDto {
  @IsString()
  hostname!: string;

  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @IsString()
  @MaxLength(2000)
  body!: string;
}
