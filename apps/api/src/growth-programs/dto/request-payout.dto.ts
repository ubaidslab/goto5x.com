import { IsNumber, Min } from "class-validator";

export class RequestPayoutDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
