import { headers } from "next/headers";
import { fetchStorefrontStore } from "../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../lib/theme-presets";
import { BrandedLoadingScreen } from "./loading-screen";

/**
 * SRS §5.74 FR-74.1 - Next.js's loading.tsx Suspense-fallback convention;
 * the first one anywhere in this app. Re-fetches the same store
 * StorefrontLayout already resolved for this request - fetch() request
 * memoization makes this a no-op extra call (the same reliance every
 * storefront page already has on store.poweredByVisible etc.), not a
 * second real round-trip.
 */
export default async function StorefrontLoading() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) return null;

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);

  return (
    <BrandedLoadingScreen
      storeName={store.name}
      logoUrl={store.logoUrl}
      theme={theme}
      showManagedByUzeyn={store.loadingScreenBrandingVisible}
    />
  );
}
