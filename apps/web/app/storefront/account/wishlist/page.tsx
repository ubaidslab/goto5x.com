import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { ChatWidget } from "../../chat/chat-widget";
import { getWishlistAction, getBuyerSession } from "../actions";
import { WishlistList } from "./wishlist-list";

export const dynamic = "force-dynamic";

/**
 * FR-66.5 (Module 85) - a buyer's saved items, platform-wide (same
 * cross-store reach as order history, FR-66.1) - reachable regardless of
 * whether the *currently browsed* store's plan includes wishlist, since a
 * saved item may belong to any store.
 */
export default async function WishlistPage() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const session = await getBuyerSession();
  if (!session) redirect("/account/login");

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);

  const wishlist = await getWishlistAction();
  if (!wishlist.ok) redirect("/account/login");

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Saved items</h1>
        <WishlistList items={wishlist.items} theme={theme} />
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
