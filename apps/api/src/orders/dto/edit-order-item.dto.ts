import { IsInt, IsUUID, Min } from "class-validator";

export class EditOrderItemDto {
  @IsUUID()
  orderItemId!: string;

  /** 0 removes the line entirely (stock is restored - FR-17.5). */
  @IsInt()
  @Min(0)
  quantity!: number;
}
