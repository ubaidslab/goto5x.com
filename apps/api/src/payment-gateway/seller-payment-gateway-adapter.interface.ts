import { PaymentGatewayProvider } from "@prisma/client";

/**
 * SRS §5.6h/FR-6.37 - one interface, four v1.0 implementations, mirroring
 * order-verification/verification-channel-adapter.interface.ts's exact
 * shape. The orchestrating service (PaymentGatewayService) never branches
 * on which provider a store connected - that logic lives entirely inside
 * each adapter, looked up from a `Map<PaymentGatewayProvider, adapter>`. A
 * future additional provider implements this same interface with zero
 * change to checkout or the Financial Truth Invariant tie-in.
 */
export interface GatewayVerifyContext {
  connection: {
    merchantId: string | null;
    /** Already-decrypted, resolved by the caller - never persisted or logged past this call. */
    apiKey: string;
    apiSecret: string | null;
  };
  orderId: string;
  amount: number;
  currency: string;
  /** Buyer-provided transaction reference from the gateway's own return redirect, when the provider issues one. */
  reference?: string;
  /**
   * FR-6.39's "test the connection" seller action - a lightweight
   * authentication-only call (e.g. an account/merchant lookup) rather than
   * checking a specific order's payment, so a seller can validate freshly
   * entered credentials before any buyer ever reaches checkout.
   */
  testMode?: boolean;
}

export interface GatewayVerifyResult {
  verified: boolean;
  providerReference?: string;
  /** The gateway's own reported transaction amount, when the provider's response includes one - lets a caller detect an amount mismatch before trusting `verified`. */
  amount?: number;
}

export interface SellerPaymentGatewayAdapter {
  readonly provider: PaymentGatewayProvider;
  verifyPayment(context: GatewayVerifyContext): Promise<GatewayVerifyResult>;
}
