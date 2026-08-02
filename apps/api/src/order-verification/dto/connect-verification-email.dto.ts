import { IsEmail, IsInt, IsString, Max, Min, MinLength } from "class-validator";

/** FR-37.3 - the seller's own SMTP sender to add to their connected-emails rotation. */
export class ConnectVerificationEmailDto {
  @IsEmail()
  emailAddress!: string;

  @IsString()
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsString()
  smtpUsername!: string;

  @IsString()
  @MinLength(1)
  smtpPassword!: string;
}
