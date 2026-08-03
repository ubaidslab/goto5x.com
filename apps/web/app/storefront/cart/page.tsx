import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontStore } from "../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../chrome";
import { CartContents } from "./cart-contents";

export const dynamic = "force-dynamic";

/**
 * FR-32.1 - shows the client-side-only cart (lib/local-cart.ts); there is no
 * server-side cart row yet at this point (FR-15.1's email-first decision).
 */
export default async function StorefrontCartPage() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <h1>Your cart</h1>
        <CartContents hostname={host} currency={store.currency} theme={theme} />
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
    </>
  );
}
