import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontProducts, fetchStorefrontStore } from "../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../lib/theme-presets";
import { ComingSoonPage, PasswordGate } from "./access-gates";
import { resolveAccess } from "./access";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "./chrome";
import { getTemplateSections } from "./templates/registry";

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

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);
  const sections = getTemplateSections(store.theme?.name ?? "Editorial");

  const access = resolveAccess(store);
  if (access.gated && access.reason === "coming_soon") return <ComingSoonPage store={store} theme={theme} />;
  if (access.gated && access.reason === "password_protected") {
    return <PasswordGate store={store} theme={theme} hostname={host} />;
  }

  const [products, navigation] = await Promise.all([
    fetchStorefrontProducts(host, access.gated ? undefined : access.unlockToken),
    fetchStorefrontNavigation(host),
  ]);

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main>
        {theme.sections
          .filter((section) => section.visible)
          .map((section) => {
            switch (section.id) {
              case "hero":
                return <sections.Hero key={section.id} store={store} theme={theme} />;
              case "featured_products":
                return <sections.FeaturedProducts key={section.id} products={products ?? []} theme={theme} />;
              case "about":
                return <sections.About key={section.id} store={store} theme={theme} />;
              case "newsletter":
                return <sections.Newsletter key={section.id} theme={theme} />;
              case "faq":
                return <sections.Faq key={section.id} theme={theme} items={theme.faqItems} />;
              default:
                return null;
            }
          })}
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
    </>
  );
}
