import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontOrderStatus, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { OrderVerificationPanel } from "../../order-status/order-verification-panel";

export const dynamic = "force-dynamic";

/**
 * FR-32.2 - reuses fetchStorefrontOrderStatus() (Module 15's own order-status
 * fetch) rather than a second "preview totals" endpoint: the order's
 * statusLookupToken returned by checkout() gives authoritative, already-
 * computed numbers with zero new backend surface (see CheckoutService).
 *
 * FR-32.3 (Financial Truth Invariant) - the order is always `pending` here;
 * this page must never say "paid" or "confirmed".
 */
export default async function OrderConfirmationPage({ params }: { params: { token: string } }) {
  const host = headers().get("host") ?? "";
  const [store, order] = await Promise.all([fetchStorefrontStore(host), fetchStorefrontOrderStatus(params.token)]);
  if (!store || !order) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            background: theme.colors.primary,
            color: "#fff",
            marginBottom: 24,
          }}
        >
          <h1 style={{ margin: "0 0 8px" }}>Thank you for your order!</h1>
          <p style={{ margin: 0 }}>
            Your order is <strong>awaiting payment</strong> - it isn't confirmed yet.
          </p>
        </div>

        <OrderVerificationPanel token={params.token} verification={order.verification} />

        <h2>Order summary</h2>
        <ul>
          {order.items.map((item, i) => (
            <li key={i}>
              {item.productTitle} - qty {item.quantity} - {order.currency} {item.unitPrice} each
            </li>
          ))}
        </ul>
        <p>
          Total: {order.currency} {order.totalAmount} (shipping {order.shippingAmount}, tax {order.taxAmount}
          {Number(order.discountAmount) > 0 && `, discount -${order.discountAmount}`})
        </p>

        {order.paymentInstructions && (
          <>
            <h2>How to pay</h2>
            <p style={{ fontSize: 14, color: "#6b7280" }}>
              Pay the seller directly using one of the methods below. Once they confirm receipt, your order moves to
              confirmed.
            </p>
            <ul>
              {order.paymentInstructions.bankAccountNumber && (
                <li>
                  Bank transfer: {order.paymentInstructions.bankName} - {order.paymentInstructions.bankAccountTitle} -{" "}
                  {order.paymentInstructions.bankAccountNumber}
                </li>
              )}
              {order.paymentInstructions.jazzcashNumber && <li>JazzCash: {order.paymentInstructions.jazzcashNumber}</li>}
              {order.paymentInstructions.easypaisaNumber && <li>Easypaisa: {order.paymentInstructions.easypaisaNumber}</li>}
              {order.paymentInstructions.codEnabled && <li>Cash on delivery accepted</li>}
            </ul>
          </>
        )}

        {order.invoicePdfUrl && (
          <p>
            <a href={order.invoicePdfUrl} target="_blank" rel="noreferrer">
              Download invoice (PDF)
            </a>
          </p>
        )}

        <p style={{ marginTop: 24 }}>
          A confirmation email with these details has been sent to you. You can track this order any time from your{" "}
          <a href={`/order-status/${params.token}`} style={{ color: theme.colors.primary, fontWeight: 600 }}>
            order status page
          </a>
          .
        </p>
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
    </>
  );
}
