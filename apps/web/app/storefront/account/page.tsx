import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontStore } from "../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../lib/theme-presets";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../chrome";
import { buyerAuthedFetch, getBuyerSession } from "./actions";
import { AccountView, BuyerAddress, BuyerProfile } from "./account-view";

export const dynamic = "force-dynamic";

/** FR-66.1 (Module 81) - the optional buyer account home: profile + saved addresses. Order history lives at /account/orders. */
export default async function BuyerAccountPage() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const session = await getBuyerSession();
  if (!session) redirect("/account/login");

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const navigation = await fetchStorefrontNavigation(host);

  const [profileRes, addressesRes] = await Promise.all([
    buyerAuthedFetch("/storefront/account/me"),
    buyerAuthedFetch("/storefront/account/addresses"),
  ]);
  if (!profileRes || !profileRes.ok) redirect("/account/login");

  const profile = (await profileRes.json()) as BuyerProfile;
  const addresses = addressesRes && addressesRes.ok ? ((await addressesRes.json()) as BuyerAddress[]) : [];

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
        <AccountView theme={theme} profile={profile} addresses={addresses} />
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
    </>
  );
}
