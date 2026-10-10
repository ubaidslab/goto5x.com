import { PaymentGatewayProvider } from "@prisma/client";

export type PaymentMethodRegistryStatus = "live" | "soon" | "verifying";

export interface PaymentMethodRegistryEntry {
  key: string;
  label: string;
  kind: "payment_model" | "gateway";
  status: PaymentMethodRegistryStatus;
}

/**
 * D95 (founder decision, 2026-10-10) - the tri-state status for every
 * buyer-facing payment path, gateway or not, in one list. This is the
 * single source of truth: a provider's status changes only by editing
 * this file in a reviewed PR together with its evidence (D86 -
 * docs/gateway-verification/<name>.md) or its contract-test suite
 * passing, never through an admin toggle - "verifying" replaces D86's
 * "dormant" label with the same rule ("nothing goes live until passing
 * the contract-test suite"), and that rule is a code/CI fact, not
 * runtime-configurable data.
 *
 * Live: COD, Advance, and manual-mark-as-paid are payment MODELS, not
 * gateways (D86) - none of the four PaymentGatewayProvider adapters are
 * live yet. "Advance" itself stays live here even while every gateway
 * is verifying, because B3 (2026-10-10, founder decision) gave it a
 * non-gateway Manual Transfer fallback - see payment-gateway.service.ts.
 *
 * Soon: these six have no adapter at all yet (M3/1C scope, D90) - listed
 * for admin visibility only, never backed by a PaymentGatewayProvider
 * enum value or a real connection.
 */
export const PAYMENT_METHOD_REGISTRY: PaymentMethodRegistryEntry[] = [
  { key: "cod", label: "Cash on Delivery", kind: "payment_model", status: "live" },
  { key: "advance", label: "Advance (deposit now, rest on delivery)", kind: "payment_model", status: "live" },
  { key: "manual_mark_as_paid", label: "Manual mark-as-paid", kind: "payment_model", status: "live" },
  { key: "raast", label: "Raast", kind: "gateway", status: "verifying" },
  { key: "easypaisa", label: "Easypaisa", kind: "gateway", status: "verifying" },
  { key: "jazzcash", label: "JazzCash", kind: "gateway", status: "verifying" },
  { key: "bank", label: "Bank transfer (gateway-verified)", kind: "gateway", status: "verifying" },
  { key: "stripe", label: "Stripe", kind: "gateway", status: "soon" },
  { key: "simpaisa", label: "Simpaisa", kind: "gateway", status: "soon" },
  { key: "airwallex", label: "Airwallex", kind: "gateway", status: "soon" },
  { key: "razorpay", label: "Razorpay", kind: "gateway", status: "soon" },
  { key: "ebanx", label: "EBANX", kind: "gateway", status: "soon" },
  { key: "skypay_global", label: "Skypay Global", kind: "gateway", status: "soon" },
];

const GATEWAY_STATUS_BY_PROVIDER: Record<PaymentGatewayProvider, PaymentMethodRegistryStatus> = {
  raast: "verifying",
  easypaisa: "verifying",
  jazzcash: "verifying",
  bank: "verifying",
};

/**
 * The one real runtime gate this registry has: whether a
 * PaymentGatewayProvider adapter may process a real buyer-facing charge
 * (PaymentGatewayService.chargeViaGateway()) or appear in the buyer-facing
 * checkout option list (listActiveForCheckout()). Deliberately NOT
 * consulted by the seller-facing connect/test/health-sweep paths - a
 * seller or the founder must still be able to connect real credentials
 * and run test-mode pings against a "verifying" provider, since that is
 * exactly how the evidence to promote it is gathered.
 */
export function isGatewayLive(provider: PaymentGatewayProvider): boolean {
  return GATEWAY_STATUS_BY_PROVIDER[provider] === "live";
}
