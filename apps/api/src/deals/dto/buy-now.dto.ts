import { IsEmail, IsOptional, IsString } from "class-validator";

/** SRS §5.67/FR-67.2 - same email-first shape as CreateCartDto (FR-15.1), minus `items` since the deal itself supplies them. */
export class BuyNowDto {
  @IsString()
  hostname!: string;

  @IsEmail()
  buyerEmail!: string;

  @IsOptional()
  @IsString()
  buyerWhatsapp?: string;
}
