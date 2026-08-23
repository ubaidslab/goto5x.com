import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}
