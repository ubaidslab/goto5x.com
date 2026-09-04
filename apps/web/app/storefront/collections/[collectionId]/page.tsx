import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontCollection, fetchStorefrontNavigation, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { ComingSoonPage, PasswordGate } from "../../access-gates";
import { resolveAccess } from "../../access";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { ChatWidget } from "../../chat/chat-widget";
import { FeaturedProductsSection } from "../../sections";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { collectionId: string } }) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  const collection = await fetchStorefrontCollection(host, params.collectionId);
  if (!collection) return {};
  const url = store ? `https://${store.canonicalHostname}/collections/${collection.id}` : undefined;
  return {
    title: collection.seoTitle,
    description: collection.seoDescription ?? undefined,
    // Module 58 (SRS §5.65, FR-65.2) - same already-resolved-server-side
    // fields as the product page; see its generateMetadata() for the
    // fallback reasoning.
    openGraph: {
      title: collection.ogTitle,
      description: collection.ogDescription ?? undefined,
      url,
      images: collection.ogImageUrl ? [collection.ogImageUrl] : undefined,
      type: "website",
    },
    robots: { index: collection.robotsIndex, follow: collection.robotsFollow },
    alternates: collection.canonicalUrl ? { canonical: collection.canonicalUrl } : undefined,
  };
}

// FR-16.1 - a collection renders its assigned products, in the seller-
// configured sort order (the API already returns them ordered by
// collection_products.sort_order).
export default async function StorefrontCollectionPage({ params }: { params: { collectionId: string } }) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);

  const access = resolveAccess(store);
  if (access.gated && access.reason === "coming_soon") return <ComingSoonPage store={store} theme={theme} />;
  if (access.gated && access.reason === "password_protected") {
    return <PasswordGate store={store} theme={theme} hostname={host} />;
  }

  const [collection, navigation] = await Promise.all([
    fetchStorefrontCollection(host, params.collectionId, access.gated ? undefined : access.unlockToken),
    fetchStorefrontNavigation(host),
  ]);
  if (!collection) notFound();

  return (
    <>
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main>
        <div style={{ padding: "24px 24px 0" }}>
          <a href="/">&larr; Back to store</a>
          <h1 style={{ color: theme.colors.primary }}>{collection.title}</h1>
          {collection.description && <p>{collection.description}</p>}
        </div>
        <FeaturedProductsSection products={collection.products} theme={theme} />
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
      <ChatWidget theme={theme} enabled={store.chatEnabled} />
    </>
  );
}
