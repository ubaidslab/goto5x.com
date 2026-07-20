import { IsNumber, IsPositive } from "class-validator";

export class RequestTopUpDto {
  @IsNumber()
  @IsPositive()
  amount!: number;
}
