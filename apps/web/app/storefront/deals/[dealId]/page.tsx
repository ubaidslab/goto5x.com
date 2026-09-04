import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontDeal, fetchStorefrontNavigation, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { ComingSoonPage, PasswordGate } from "../../access-gates";
import { resolveAccess } from "../../access";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { ChatWidget } from "../../chat/chat-widget";
import { DealBuyNowForm } from "./deal-buy-now-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { dealId: string } }) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  const deal = store ? await fetchStorefrontDeal(host, params.dealId) : null;
  if (!store || !deal) return {};
  return { title: `${deal.title} - ${deal.discountPercent}% off - ${store.name}`, description: deal.description ?? undefined };
}

/** SRS §5.67/FR-67.2/67.3 - bundled items, the uniform discount, and the buy-now action. */
export default async function StorefrontDealPage({ params }: { params: { dealId: string } }) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);

  const access = resolveAccess(store);
  if (access.gated && access.reason === "coming_soon") return <ComingSoonPage store={store} theme={theme} />;
  if (access.gated && access.reason === "password_protected") {
    return <PasswordGate store={store} theme={theme} hostname={host} />;
  }

  const [deal, navigation] = await Promise.all([fetchStorefrontDeal(host, params.dealId), fetchStorefrontNavigation(host)]);
  if (!deal) notFound();

  const originalTotal = deal.items.reduce((sum, item) => sum + item.price, 0);
  const discountedTotal = deal.items.reduce((sum, item) => sum + item.discountedPrice, 0);
  const anyOutOfStock = deal.items.some((item) => !item.inStock);

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: "24px", maxWidth: 960, margin: "0 auto", color: theme.colors.text }}>
        <a href="/deals" style={{ color: theme.colors.text, opacity: 0.7, fontSize: 14 }}>
          &larr; All deals
        </a>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, marginTop: 16 }}>
          <div style={{ flex: "1 1 320px" }}>
            <span
              style={{
                display: "inline-block",
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                background: theme.colors.primary,
                borderRadius: 999,
                padding: "4px 12px",
                marginBottom: 12,
              }}
            >
              {deal.discountPercent}% off, all {deal.items.length} item{deal.items.length === 1 ? "" : "s"}
            </span>
            <h1 style={{ color: theme.colors.primary, margin: "0 0 8px" }}>{deal.title}</h1>
            {deal.description && <p>{deal.description}</p>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 20 }}>
              {deal.items.map((item) => (
                <div key={item.variantId} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.title} style={{ width: "100%", height: 100, objectFit: "cover" }} />
                  )}
                  <div style={{ padding: 10 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{item.title}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                      <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: 6 }}>
                        {store.currency} {item.price.toFixed(2)}
                      </span>
                      <strong style={{ color: theme.colors.primary }}>
                        {store.currency} {item.discountedPrice.toFixed(2)}
                      </strong>
                    </p>
                    {!item.inStock && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b91c1c" }}>Out of stock</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: "0 0 320px" }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, position: "sticky", top: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ opacity: 0.7 }}>Bundle price</span>
                <span style={{ textDecoration: "line-through", opacity: 0.5 }}>
                  {store.currency} {originalTotal.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
                <span>Deal price</span>
                <span style={{ color: theme.colors.primary }}>
                  {store.currency} {discountedTotal.toFixed(2)}
                </span>
              </div>
              {anyOutOfStock ? (
                <p style={{ color: "#b91c1c", fontSize: 14 }}>
                  One or more items in this deal are currently out of stock - the whole bundle is unavailable until restocked.
                </p>
              ) : (
                <DealBuyNowForm hostname={host} dealId={deal.id} currency={store.currency} theme={theme} disabled={deal.items.length === 0} />
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
      <ChatWidget theme={theme} enabled={store.chatEnabled} />
    </>
  );
}
