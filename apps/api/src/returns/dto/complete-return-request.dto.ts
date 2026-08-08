import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, Min, ValidateNested } from "class-validator";
import { RefundedOrderItemDto } from "./refunded-order-item.dto";

/** FR-60.4 - the money-touching step; refundAmount is what actually drives the ledger reversal, refundedItems is record-keeping only. */
export class CompleteReturnRequestDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  refundAmount!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundedOrderItemDto)
  refundedItems?: RefundedOrderItemDto[];
}
