import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  fetchStorefrontCollection,
  fetchStorefrontCollections,
  fetchStorefrontDeals,
  fetchStorefrontNavigation,
  fetchStorefrontProducts,
  fetchStorefrontStore,
} from "../../lib/storefront-api";
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

  const needsCollection = theme.sections.some((s) => s.visible && s.id === "featured_collection");
  const [products, navigation, collections, deals] = await Promise.all([
    fetchStorefrontProducts(host, access.gated ? undefined : access.unlockToken),
    fetchStorefrontNavigation(host),
    needsCollection ? fetchStorefrontCollections(host, access.gated ? undefined : access.unlockToken) : Promise.resolve([]),
    fetchStorefrontDeals(host),
  ]);
  const featuredCollection = collections[0]
    ? await fetchStorefrontCollection(host, collections[0].id, access.gated ? undefined : access.unlockToken)
    : null;

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      {deals.length > 0 && (
        <a
          href="/deals"
          style={{
            display: "block",
            textAlign: "center",
            padding: "10px 16px",
            background: theme.colors.primary,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          {deals.length} deal{deals.length === 1 ? "" : "s"} live right now - up to{" "}
          {Math.max(...deals.map((d) => d.discountPercent))}% off &rarr;
        </a>
      )}
      <main>
        {theme.sections
          .filter((section) => section.visible)
          .map((section) => {
            const variant = section.variant;
            const elementAnimations = section.elementAnimations;
            switch (section.id) {
              case "hero":
                return <sections.Hero key={section.id} store={store} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "featured_products":
                return (
                  <sections.FeaturedProducts key={section.id} products={products ?? []} theme={theme} variant={variant} elementAnimations={elementAnimations} />
                );
              case "about":
                return <sections.About key={section.id} store={store} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "newsletter":
                return <sections.Newsletter key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "faq":
                return <sections.Faq key={section.id} theme={theme} items={theme.faqItems} variant={variant} elementAnimations={elementAnimations} />;
              case "testimonials":
                return <sections.Testimonials key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "footer_contact":
                return <sections.FooterContact key={section.id} theme={theme} store={store} variant={variant} elementAnimations={elementAnimations} />;
              case "spacer":
                return <sections.Spacer key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "featured_collection":
                return (
                  <sections.FeaturedCollection key={section.id} theme={theme} collection={featuredCollection} variant={variant} elementAnimations={elementAnimations} />
                );
              case "gallery":
                return <sections.Gallery key={section.id} theme={theme} images={[]} variant={variant} elementAnimations={elementAnimations} />;
              case "video_banner":
                return <sections.VideoBanner key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "countdown":
                return <sections.Countdown key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "stats_counter":
                return <sections.StatsCounter key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "logo_cloud":
                return <sections.LogoCloud key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "team":
                return <sections.Team key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "before_after":
                return <sections.BeforeAfter key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "map_location":
                return <sections.MapLocation key={section.id} theme={theme} store={store} variant={variant} elementAnimations={elementAnimations} />;
              case "social_feed":
                return <sections.SocialFeed key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "sticky_cta":
                return <sections.StickyCta key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "shape_divider":
                return <sections.ShapeDivider key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
              case "comparison_table":
                return (
                  <sections.ComparisonTable key={section.id} theme={theme} products={products ?? []} variant={variant} elementAnimations={elementAnimations} />
                );
              case "blog_highlight":
                return <sections.BlogHighlight key={section.id} theme={theme} variant={variant} elementAnimations={elementAnimations} />;
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
