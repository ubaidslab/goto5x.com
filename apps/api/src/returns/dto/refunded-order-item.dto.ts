import { IsInt, IsUUID, Min } from "class-validator";

/** FR-60.1's `refundedItems` - a record-keeping breakdown only; `refundAmount` on the parent DTO is the figure that actually drives the ledger reversal. */
export class RefundedOrderItemDto {
  @IsUUID()
  orderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
