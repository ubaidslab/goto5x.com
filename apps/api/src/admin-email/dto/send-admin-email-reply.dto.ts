import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class SendAdminEmailReplyDto {
  @IsUUID()
  accountId!: string;

  @IsEmail()
  to!: string;

  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  inReplyTo?: string;
}
