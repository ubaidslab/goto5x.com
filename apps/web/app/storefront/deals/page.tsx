import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontDeals, fetchStorefrontNavigation, fetchStorefrontStore } from "../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../lib/theme-presets";
import { ComingSoonPage, PasswordGate } from "../access-gates";
import { resolveAccess } from "../access";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../chrome";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) return {};
  return { title: `Deals - ${store.name}` };
}

/** SRS §5.67/FR-67.3 - every active, in-window deal for this store. */
export default async function StorefrontDealsPage() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);

  const access = resolveAccess(store);
  if (access.gated && access.reason === "coming_soon") return <ComingSoonPage store={store} theme={theme} />;
  if (access.gated && access.reason === "password_protected") {
    return <PasswordGate store={store} theme={theme} hostname={host} />;
  }

  const [deals, navigation] = await Promise.all([fetchStorefrontDeals(host), fetchStorefrontNavigation(host)]);

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text, minHeight: "50vh" }}>
        <h1 style={{ color: theme.colors.primary, marginBottom: 8 }}>Deals</h1>
        {deals.length === 0 ? (
          <p>No deals are running right now - check back soon.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20, marginTop: 24 }}>
            {deals.map((deal) => (
              <a
                key={deal.id}
                href={`/deals/${deal.id}`}
                style={{
                  color: theme.colors.text,
                  textDecoration: "none",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "hidden",
                  display: "block",
                }}
              >
                {deal.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={deal.thumbnailUrl} alt={deal.title} style={{ width: "100%", height: 160, objectFit: "cover" }} />
                )}
                <div style={{ padding: 16 }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      background: theme.colors.primary,
                      borderRadius: 999,
                      padding: "3px 10px",
                      marginBottom: 8,
                    }}
                  >
                    {deal.discountPercent}% off
                  </span>
                  <h3 style={{ margin: 0 }}>{deal.title}</h3>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
                    {deal.items.length} item{deal.items.length === 1 ? "" : "s"} bundled
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
    </>
  );
}
