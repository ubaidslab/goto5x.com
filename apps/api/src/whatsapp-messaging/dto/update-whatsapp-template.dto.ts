import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** Phase 4 close-out - the cart-recovery message template a seller can edit for their own store. */
export class UpdateWhatsAppTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  template!: string;
}
