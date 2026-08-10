import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { PaymentGatewayProvider } from "@prisma/client";

/** FR-6.36/6.39 - connecting (or reconnecting with fresh credentials) a provider. */
export class ConnectPaymentGatewayDto {
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
