import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontNavigation, fetchStorefrontProduct, fetchStorefrontStore } from "../../../../lib/storefront-api";
import { resolveThemeSettings, ThemeSettings } from "../../../../lib/theme-presets";
import { ComingSoonPage, PasswordGate } from "../../access-gates";
import { resolveAccess } from "../../access";
import { AnnouncementBar, SiteFooter, SiteHeader, WhatsappButton } from "../../chrome";
import { ChatWidget } from "../../chat/chat-widget";
import { DeliveryBadge } from "../../delivery-badge";
import { getBuyerSession, isWishlistedAction } from "../../account/actions";
import { WishlistButton } from "../../wishlist/wishlist-button";
import { AddToCartForm } from "./add-to-cart-form";
import { ProductGallery } from "./product-gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { productId: string } }) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) return {};
  const product = await fetchStorefrontProduct(host, params.productId);
  if (!product) return {};
  const url = `https://${store.canonicalHostname}/products/${product.id}`;
  return {
    title: product.seoTitle,
    description: product.seoDescription ?? undefined,
    // FR-16.6 - OpenGraph tags read from the same SEO fallback data as
    // everything else, never a second/parallel set of SEO fields.
    openGraph: {
      // Module 58 (SRS §5.65, FR-65.2) - ogTitle/ogDescription/ogImageUrl
      // are already resolved server-side (fall back to seo.title/
      // seo.description/the first media image when unset).
      title: product.ogTitle,
      description: product.ogDescription ?? undefined,
      url,
      images: product.ogImageUrl ? [product.ogImageUrl] : product.media[0] ? [product.media[0].url] : undefined,
      type: "website",
    },
    // FR-65.2 - per-product robots directive, independent of the store-
    // wide robots.ts default.
    robots: { index: product.robotsIndex, follow: product.robotsFollow },
    // FR-65.2/65.3 - both null-safe: an unset canonicalUrl omits the tag
    // entirely (Next.js's own default - the page's own URL - already
    // applies); a set Product.slug never replaces the id-based `url` above.
    alternates: product.canonicalUrl ? { canonical: product.canonicalUrl } : undefined,
  };
}

export default async function StorefrontProductPage({ params }: { params: { productId: string } }) {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  if (!store) notFound();

  const theme = resolveThemeSettings(store.theme?.name ?? "Editorial", store.theme?.settings as ThemeSettings | undefined);

  const access = resolveAccess(store);
  if (access.gated && access.reason === "coming_soon") return <ComingSoonPage store={store} theme={theme} />;
  if (access.gated && access.reason === "password_protected") {
    return <PasswordGate store={store} theme={theme} hostname={host} />;
  }

  const [product, navigation] = await Promise.all([
    fetchStorefrontProduct(host, params.productId, access.gated ? undefined : access.unlockToken),
    fetchStorefrontNavigation(host),
  ]);
  if (!product) notFound();

  // FR-66.5 (Module 85) - resolved server-side so the initial render
  // already reflects the buyer's real saved state, no client-side flash.
  const buyerSession = await getBuyerSession();
  const initiallyWishlisted = buyerSession ? await isWishlistedAction(product.id) : false;

  // FR-16.6 - schema.org Product JSON-LD. One price (the first variant's) -
  // v1.0 has no "from $X" multi-variant-range convention to build yet.
  const firstVariant = product.variants[0];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.seoDescription ?? product.description ?? undefined,
    image: product.media.filter((m) => m.type === "image").map((m) => m.url),
    ...(firstVariant && {
      offers: {
        "@type": "Offer",
        priceCurrency: store.currency,
        price: firstVariant.price,
        availability: firstVariant.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    }),
    ...(product.reviewCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.averageRating,
        reviewCount: product.reviewCount,
      },
    }),
  };

  return (
    <>
      {/* Module 58 (SRS §5.65, FR-65.2) - structuredDataEnabled toggle; the
          JSON-LD block itself is unchanged (FR-16.6), just conditionally
          rendered now instead of unconditionally. */}
      {product.structuredDataEnabled && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      )}
      <AnnouncementBar theme={theme} />
      <SiteHeader navigation={navigation} theme={theme} store={store} />
      <main style={{ padding: 24 }}>
        <a href="/">&larr; Back to store</a>
        <h1>{product.title}</h1>
        <ProductGallery media={product.media} title={product.title} />
        {product.description && <p>{product.description}</p>}
        {/* SRS §5.69/FR-69.3 (Module 94) - buyer-facing by default, no seller
            opt-in required (contrast with tags' FR-57.4 opt-in). Absent
            entirely when a product has none. */}
        {product.customAttributes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16 }}>Product details</h2>
            <table>
              <tbody>
                {product.customAttributes.map((attr) => (
                  <tr key={attr.key}>
                    <td style={{ paddingRight: 16, fontWeight: 600 }}>{attr.key}</td>
                    <td>{attr.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DeliveryBadge supplierShipping={product.supplierShipping} theme={theme} />
        <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <AddToCartForm
            hostname={host}
            productId={product.id}
            productTitle={product.title}
            variants={product.variants}
            currency={store.currency}
            theme={theme}
            lowStockThreshold={store.lowStockThreshold}
          />
          <WishlistButton
            productId={product.id}
            enabled={store.wishlistEnabled}
            loggedIn={Boolean(buyerSession)}
            initiallyWishlisted={initiallyWishlisted}
            theme={theme}
          />
        </div>
        <p>
          Rating: {product.averageRating} ({product.reviewCount} reviews)
        </p>
      </main>
      <SiteFooter navigation={navigation} theme={theme} poweredByVisible={store.poweredByVisible} />
      <WhatsappButton theme={theme} />
      <ChatWidget theme={theme} enabled={store.chatEnabled} />
    </>
  );
}
