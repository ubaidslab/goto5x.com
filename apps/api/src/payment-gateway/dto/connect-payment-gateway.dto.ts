import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { PaymentGatewayProvider } from "@prisma/client";

/** FR-6.36/6.39 - connecting (or reconnecting with fresh credentials) a provider. */
export class ConnectPaymentGatewayDto {
  @IsEnum(["raast", "easypaisa", "jazzcash", "bank", "stripe"])
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

  /**
   * B2 (founder decision) - Stripe-only: the signing secret from the
   * webhook endpoint the seller creates in their own Stripe Dashboard
   * (docs/stripe-seller-setup.md). PaymentGatewayService.connect()
   * enforces this is present when provider === "stripe", rather than a
   * conditional class-validator decorator - the DTO stays provider-
   * agnostic, the one provider-specific rule lives with the rest of
   * Stripe's connect-time validation in the service.
   */
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
