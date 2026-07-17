import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, ValidateNested } from "class-validator";
import { EditOrderItemDto } from "./edit-order-item.dto";
import { ShippingAddressDto } from "./shipping-address.dto";

/**
 * FR-17.5 - "Basic order editing" (bounded, same "basic" framing as the FR
 * text itself): existing line items' quantities and the shipping address
 * only. Only while the order is `pending`/`confirmed` (enforced in
 * OrdersService.editOrder(), not here - a status check is a business rule,
 * not a shape constraint).
 */
export class EditOrderDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EditOrderItemDto)
  items?: EditOrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;
}
