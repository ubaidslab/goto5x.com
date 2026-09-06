import { IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength } from "class-validator";
import { MAX_MONEY_VALUE } from "../../common/validation/money.constants";

/** FR-49.2 - the seller-issued path (goodwill/store credit); never a revenue event. */
export class IssueGiftCardDto {
  @IsNumber()
  @IsPositive()
  @Max(MAX_MONEY_VALUE)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: "code may only contain letters, numbers, underscores, and hyphens" })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
