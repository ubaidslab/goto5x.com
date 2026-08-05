import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class LinkAdminEmailAccountDto {
  @IsEmail()
  emailAddress!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  imapHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort!: number;

  @IsOptional()
  @IsBoolean()
  imapUseTls?: boolean;

  @IsString()
  imapUsername!: string;

  @IsString()
  @MinLength(1)
  imapPassword!: string;

  @IsString()
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsOptional()
  @IsBoolean()
  smtpUseTls?: boolean;

  @IsString()
  smtpUsername!: string;

  @IsString()
  @MinLength(1)
  smtpPassword!: string;
}
