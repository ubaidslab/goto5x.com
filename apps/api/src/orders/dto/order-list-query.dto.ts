import { Type } from "class-transformer";
import { IsEnum, IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { OrderStatus, OrderVerificationStatus, PaymentStatus } from "@prisma/client";
import { ORDER_BUCKETS, OrderBucket } from "../orders-overview.service";

/**
 * SRS §5.59/FR-59.4 - the dashboard order-list advanced search/filter/
 * pagination surface. Every field optional and combinable, same discipline
 * as ProductListQueryDto (FR-57.2). `dateFrom`/`dateTo` are full timestamps
 * (not date-only) per FR-59.4's explicit "date AND time range" requirement.
 */
export class OrderListQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsIn(ORDER_BUCKETS)
  bucket?: OrderBucket;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(OrderVerificationStatus)
  verificationStatus?: OrderVerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  courier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customer?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
