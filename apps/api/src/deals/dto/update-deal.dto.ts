import { DealStatus } from "@prisma/client";
import { IsEnum, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, Max, MaxLength } from "class-validator";

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,63}$/, {
    message: "slug must be 1-63 lowercase letters, numbers, or hyphens",
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  thumbnailMediaId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsEnum(DealStatus)
  status?: DealStatus;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}
