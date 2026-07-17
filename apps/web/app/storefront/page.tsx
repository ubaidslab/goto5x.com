import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontProducts, fetchStorefrontStore } from "../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../lib/theme-presets";
import { AboutSection, FeaturedProductsSection, HeroSection, NewsletterSection } from "./sections";

// The Host header is different on every request (a different tenant per
// hostname) - this page can never be statically rendered/cached at build
// time, same reasoning as app/sitemap.ts and app/robots.ts.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) return {};
  return { title: store.seoTitle, description: store.seoDescription ?? undefined };
}

export default async function StorefrontHomePage() {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const products = await fetchStorefrontProducts(host);
  const theme = resolveThemeSettings(store.theme?.name ?? "Classic", store.theme?.settings as ThemeSettings | undefined);

  return (
    <main>
      {theme.sections
        .filter((section) => section.visible)
        .map((section) => {
          switch (section.id) {
            case "hero":
              return <HeroSection key={section.id} store={store} theme={theme} />;
            case "featured_products":
              return <FeaturedProductsSection key={section.id} products={products} theme={theme} />;
            case "about":
              return <AboutSection key={section.id} store={store} theme={theme} />;
            case "newsletter":
              return <NewsletterSection key={section.id} theme={theme} />;
            default:
              return null;
          }
        })}
    </main>
  );
}
