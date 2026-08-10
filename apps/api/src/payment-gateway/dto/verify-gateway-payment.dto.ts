import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentGatewayProvider } from "@prisma/client";

/** FR-6.38 - the buyer's submission after returning from the gateway's own payment page. */
export class VerifyGatewayPaymentDto {
  @IsEnum(["raast", "easypaisa", "jazzcash", "bank"])
  provider!: PaymentGatewayProvider;

  @IsOptional()
  @IsString()
  reference?: string;
}
