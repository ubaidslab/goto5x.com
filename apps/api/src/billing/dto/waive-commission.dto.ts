import { IsPositive, IsUUID } from "class-validator";

export class WaiveCommissionDto {
  @IsUUID()
  sellerId!: string;

  @IsUUID()
  orderId!: string;

  @IsPositive()
  amount!: number;
}
