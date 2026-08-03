import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  fetchStorefrontCategories,
  fetchStorefrontNavigation,
  fetchStorefrontSearch,
  fetchStorefrontStore,
} from "../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../lib/theme-presets";
import { ComingSoonPage, PasswordGate } from "../access-gates";
import { resolveAccess } from "../access";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../chrome";
import { FeaturedProductsSection } from "../sections";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: { q?: string; minPrice?: string; maxPrice?: string; categoryId?: string; collectionId?: string };
}

// FR-16.2 - Postgres full-text search + price/category/collection filters.
// A plain GET form (no client JS) - the filter state lives entirely in the
// URL, so results are shareable/bookmarkable and work with the browser's
// back button for free.
export default async function StorefrontSearchPage({ searchParams }: SearchPageProps) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);

  const access = resolveAccess(store);
  if (access.gated && access.reason === "coming_soon") return <ComingSoonPage store={store} theme={theme} />;
  if (access.gated && access.reason === "password_protected") {
    return <PasswordGate store={store} theme={theme} hostname={host} />;
  }

  const unlockToken = access.gated ? undefined : access.unlockToken;
  const [results, categories, navigation] = await Promise.all([
    fetchStorefrontSearch(host, searchParams, unlockToken),
    fetchStorefrontCategories(host),
    fetchStorefrontNavigation(host),
  ]);

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24 }}>
        <a href="/">&larr; Back to store</a>
        <h1 style={{ color: theme.colors.primary }}>Search</h1>
        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <input type="search" name="q" defaultValue={searchParams.q ?? ""} placeholder="Search products" />
          <input type="number" name="minPrice" defaultValue={searchParams.minPrice ?? ""} placeholder="Min price" />
          <input type="number" name="maxPrice" defaultValue={searchParams.maxPrice ?? ""} placeholder="Max price" />
          <select name="categoryId" defaultValue={searchParams.categoryId ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit">Search</button>
        </form>
        <FeaturedProductsSection products={results ?? []} theme={theme} />
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
    </>
  );
}
