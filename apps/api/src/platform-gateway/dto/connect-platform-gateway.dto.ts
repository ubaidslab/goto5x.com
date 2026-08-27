import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { PaymentGatewayProvider } from "@prisma/client";

/** Mirrors ConnectPaymentGatewayDto exactly - same fields, platform-level (no storeId). */
export class ConnectPlatformGatewayDto {
  @IsEnum(["raast", "easypaisa", "jazzcash", "bank"])
  provider!: PaymentGatewayProvider;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsString()
  @MinLength(1)
  apiKey!: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;
}
