import { IsString, MaxLength, MinLength } from "class-validator";

/** FR-17.2 - never shown to the buyer. */
export class AddOrderNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
