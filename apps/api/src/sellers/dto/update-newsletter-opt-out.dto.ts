import { IsBoolean } from "class-validator";

export class UpdateNewsletterOptOutDto {
  @IsBoolean()
  newsletterOptOut!: boolean;
}
