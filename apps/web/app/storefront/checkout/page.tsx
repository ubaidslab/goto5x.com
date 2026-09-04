import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontStore } from "../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../chrome";
import { ChatWidget } from "../chat/chat-widget";
import { BuyerAddress } from "../account/account-view";
import { buyerAuthedFetch } from "../account/actions";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

/**
 * FR-15.1/FR-32.1 - the locked email-first UX: this page's first step is
 * always the buyer's email, before shipping details or anything else.
 */
export default async function StorefrontCheckoutPage() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);

  // FR-66.1 (Module 81) - "faster reorder": prefill from the logged-in
  // buyer's default saved address, if any. Best-effort only - a missing
  // session, an API error, or no default address all just fall through to
  // the ordinary blank form guest checkout already uses.
  const addressesRes = await buyerAuthedFetch("/storefront/account/addresses");
  const savedAddresses = addressesRes && addressesRes.ok ? ((await addressesRes.json()) as BuyerAddress[]) : [];
  const defaultAddress = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0] ?? null;

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <h1>Checkout</h1>
        <CheckoutForm hostname={host} currency={store.currency} theme={theme} savedAddress={defaultAddress} />
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
      <ChatWidget theme={theme} enabled={store.chatEnabled} />
    </>
  );
}
