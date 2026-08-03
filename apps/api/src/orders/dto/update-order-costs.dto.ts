import { IsNumber, IsOptional, Min } from "class-validator";

/** Module 31 (SRS §5.42/FR-42.1) - optional per-order courier/handling costs for the P&L engine. */
export class UpdateOrderCostsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  courierCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  handlingCost?: number;
}
