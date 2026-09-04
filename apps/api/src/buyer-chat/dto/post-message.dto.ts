import { IsString, MaxLength } from "class-validator";

export class PostMessageDto {
  @IsString()
  @MaxLength(2000)
  body!: string;
}
