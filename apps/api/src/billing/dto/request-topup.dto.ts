import { IsNumber, IsPositive, Max } from "class-validator";
import { MAX_MONEY_VALUE } from "../../common/validation/money.constants";

export class RequestTopUpDto {
  @IsNumber()
  @IsPositive()
  @Max(MAX_MONEY_VALUE)
  amount!: number;
}
