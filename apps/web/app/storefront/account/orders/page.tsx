import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { ChatWidget } from "../../chat/chat-widget";
import { buyerAuthedFetch, getBuyerSession } from "../actions";

export const dynamic = "force-dynamic";

interface BuyerOrderSummary {
  id: string;
  orderNumber: number;
  status: string;
  placedAt: string;
  currency: string;
  totalAmount: string;
  statusLookupToken: string;
  storeName: string;
  storeSlug: string;
}

/**
 * FR-66.1 (Module 81) - a buyer's order history. Platform-wide (every
 * store they've ordered from), each row linking into the existing
 * order-status/[token] page for full detail rather than duplicating
 * that projection here.
 */
export default async function BuyerOrdersPage() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const session = await getBuyerSession();
  if (!session) redirect("/account/login");

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);

  const res = await buyerAuthedFetch("/storefront/account/orders");
  if (!res || !res.ok) redirect("/account/login");
  const orders = (await res.json()) as BuyerOrderSummary[];

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Order history</h1>
        {orders.length === 0 && <p style={{ fontSize: 14, color: "#6b7280" }}>No orders yet.</p>}
        {orders.map((order) => (
          <a
            key={order.id}
            href={`/order-status/${order.statusLookupToken}`}
            style={{
              display: "block",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              textDecoration: "none",
              color: theme.colors.text,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>
                #{order.orderNumber} - {order.storeName}
              </strong>
              <span style={{ textTransform: "capitalize", fontSize: 13, color: "#6b7280" }}>{order.status}</span>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              {new Date(order.placedAt).toLocaleDateString()} - {order.currency} {order.totalAmount}
            </p>
          </a>
        ))}
        <p style={{ marginTop: 20 }}>
          <a href="/account" style={{ color: theme.colors.primary, fontWeight: 600 }}>
            &larr; Back to account
          </a>
        </p>
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
      <ChatWidget theme={theme} enabled={store.chatEnabled} />
    </>
  );
}
