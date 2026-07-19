import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontOrderStatus, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { ReviewForm } from "../review-form";

export const dynamic = "force-dynamic";

/**
 * FR-5.4 - the buyer's only post-checkout reference (no account exists to
 * log into). Deliberately not access-gated the way product/collection
 * pages are (coming-soon/password) - a buyer who already placed a real
 * order must still be able to check on it.
 */
export default async function OrderStatusPage({ params }: { params: { token: string } }) {
  const host = headers().get("host") ?? "";
  const [store, order] = await Promise.all([fetchStorefrontStore(host), fetchStorefrontOrderStatus(params.token)]);
  if (!store || !order) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Classic", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);
  const address = order.shippingAddress;

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} />
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1>Order status</h1>
        <p>
          Status: <strong>{order.status === "pending" ? "Awaiting payment" : order.status}</strong>
        </p>
        <p>Placed {new Date(order.placedAt).toLocaleString()}</p>

        <h2>Items</h2>
        <ul>
          {order.items.map((item, i) => (
            <li key={i}>
              {item.productTitle} - qty {item.quantity} - {order.currency} {item.unitPrice} each ({item.fulfillmentStatus})
              {item.trackingUpdates.length > 0 && (
                <span>
                  {" "}
                  - tracking: {item.trackingUpdates.map((t) => `${t.trackingId}${t.carrier ? ` (${t.carrier})` : ""}`).join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>

        <h2>Total</h2>
        <p>
          {order.currency} {order.totalAmount} (shipping {order.shippingAmount}, tax {order.taxAmount}
          {Number(order.discountAmount) > 0 && `, discount -${order.discountAmount}`})
        </p>

        {order.invoicePdfUrl && (
          <p>
            <a href={order.invoicePdfUrl} target="_blank" rel="noreferrer">
              Download invoice (PDF)
            </a>
          </p>
        )}

        {order.paymentInstructions && (
          <>
            <h2>How to pay</h2>
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

        <h2>Shipping to</h2>
        <p>
          {address.fullName}
          <br />
          {address.line1}
          {address.line2 && (
            <>
              <br />
              {address.line2}
            </>
          )}
          <br />
          {address.city}, {address.country} {address.postalCode}
          <br />
          {address.phone}
        </p>

        <h2>Leave a review</h2>
        <ReviewForm token={params.token} items={order.items.map((i) => ({ productId: i.productId, productTitle: i.productTitle }))} />
      </main>
      <SiteFooter navigation={navigation} theme={theme} />
      <WhatsappButton theme={theme} />
    </>
  );
}
