import { IsIn, IsInt, IsString, MaxLength, Min } from "class-validator";

export class AdjustStockDto {
  @IsIn(["increment", "decrement", "set"])
  type!: "increment" | "decrement" | "set";

  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  @MaxLength(200)
  reason!: string;
}
