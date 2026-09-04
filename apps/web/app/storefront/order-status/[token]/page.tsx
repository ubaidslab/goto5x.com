import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontOrderStatus, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { ChatWidget } from "../../chat/chat-widget";
import { ModelAdvancePanel } from "../model-advance-panel";
import { OrderVerificationPanel } from "../order-verification-panel";
import { ReturnRequestForm } from "../return-request-form";
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

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);

  const trackingStateLabel: Record<string, string> = {
    pending: "Pending",
    submitted_to_courier: "Submitted to Courier",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  // SRS §5.38/FR-38.9 - the collapsed, archived shape. Display
  // simplification only; the underlying order is untouched.
  if (order.archived) {
    return (
      <>
        <AnnouncementBar theme={theme} />
        <SiteHeader navigation={navigation} theme={theme} store={store} />
        <main style={{ padding: 24, maxWidth: 720 }}>
          <h1>Order status</h1>
          <p style={{ fontWeight: 600, fontSize: 18 }}>{trackingStateLabel[order.trackingState]}</p>
          <p>{order.trackingMessage}</p>
          {order.deliveredAt && <p>Delivered on {new Date(order.deliveredAt).toLocaleDateString()}</p>}
          <p>
            {order.currency} {order.totalAmount}
          </p>
          {order.invoicePdfUrl && (
            <p>
              <a href={order.invoicePdfUrl} target="_blank" rel="noreferrer">
                Download invoice (PDF)
              </a>
            </p>
          )}
          {(order.canRequestReturn || order.returnRequests.length > 0) && (
            <>
              <h2>Return &amp; refund</h2>
              <ReturnRequestForm
                token={params.token}
                canRequestReturn={order.canRequestReturn}
                currency={order.currency}
                returnRequests={order.returnRequests}
              />
            </>
          )}
        </main>
        <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
        <WhatsappButton theme={theme} />
        <ChatWidget theme={theme} enabled={store.chatEnabled} />
      </>
    );
  }

  const address = order.shippingAddress;
  // FR-38.7 - "we provide the door, not fake data behind it": whenever any
  // item has a courier tracking update, surface the courier's own name +
  // tracking ID/link so the buyer can check real-time precision on the
  // courier's own site if they want it.
  const trackingUpdates = order.items.flatMap((item) => item.trackingUpdates);

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24, maxWidth: 720 }}>
        <h1>Order status</h1>
        <p style={{ color: "#6b7280" }}>Check your order's payment status, items, and shipping progress any time using this link.</p>
        <p style={{ fontWeight: 600, fontSize: 18 }}>{trackingStateLabel[order.trackingState]}</p>
        <p>{order.trackingMessage}</p>
        <p>Placed {new Date(order.placedAt).toLocaleString()}</p>

        {trackingUpdates.length > 0 && (
          <ul>
            {trackingUpdates.map((t, i) => (
              <li key={i}>
                {t.carrier ? `${t.carrier} - ` : ""}
                Tracking ID: {t.trackingId}
                {t.trackingUrl && (
                  <>
                    {" - "}
                    <a href={t.trackingUrl} target="_blank" rel="noreferrer">
                      Track on courier's site
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <OrderVerificationPanel token={params.token} verification={order.verification} />
        <ModelAdvancePanel token={params.token} paymentModel={order.paymentModel} orderStatus={order.status} />

        <h2>Order timeline</h2>
        <ol style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {order.timeline.map((stage) => (
            <li key={stage.stage} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: stage.completedAt ? "#16a34a" : "#d1d5db",
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <span style={{ fontWeight: stage.completedAt ? 600 : 400 }}>{stage.label}</span>
              {stage.completedAt && (
                <span style={{ color: "#6b7280", fontSize: 13 }}>{new Date(stage.completedAt).toLocaleString()}</span>
              )}
            </li>
          ))}
        </ol>

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

        {(order.canRequestReturn || order.returnRequests.length > 0) && (
          <>
            <h2>Return &amp; refund</h2>
            <ReturnRequestForm
              token={params.token}
              canRequestReturn={order.canRequestReturn}
              currency={order.currency}
              returnRequests={order.returnRequests}
            />
          </>
        )}

        <h2>Leave a review</h2>
        <ReviewForm token={params.token} items={order.items.map((i) => ({ productId: i.productId, productTitle: i.productTitle }))} />
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
      <ChatWidget theme={theme} enabled={store.chatEnabled} />
    </>
  );
}
