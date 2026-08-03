import { PublicProduct, PublicStore } from "../../lib/storefront-api";
import { ResolvedThemeSettings } from "../../lib/theme-presets";
import { DeliveryBadge } from "./delivery-badge";

export function HeroSection({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section style={{ padding: "64px 24px", textAlign: "center", background: theme.colors.background, color: theme.colors.text }}>
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt={store.name} style={{ maxHeight: 64 }} />
      )}
      <h1 style={{ color: theme.colors.primary }}>{store.name}</h1>
      {store.seoDescription && <p>{store.seoDescription}</p>}
    </section>
  );
}

export function FeaturedProductsSection({ products, theme }: { products: PublicProduct[]; theme: ResolvedThemeSettings }) {
  return (
    <section style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
      <h2 style={{ color: theme.colors.primary }}>Products</h2>
      {products.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              style={{ color: theme.colors.text, textDecoration: "none", border: "1px solid #e5e7eb", padding: 12, borderRadius: 8 }}
            >
              {product.media[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.media[0].url} alt={product.title} style={{ width: "100%", height: 140, objectFit: "cover" }} />
              )}
              <h3>{product.title}</h3>
              {product.variants[0] && <p>{product.variants[0].price}</p>}
              <DeliveryBadge supplierShipping={product.supplierShipping} theme={theme} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export function AboutSection({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
      <h2 style={{ color: theme.colors.primary }}>About {store.name}</h2>
      <p>{store.seoDescription ?? `${store.name} is a store on goto5x.com.`}</p>
    </section>
  );
}

export function NewsletterSection({ theme }: { theme: ResolvedThemeSettings }) {
  return (
    <section style={{ padding: "32px 24px", textAlign: "center", background: theme.colors.background, color: theme.colors.text }}>
      <h2 style={{ color: theme.colors.primary }}>Stay updated</h2>
      <p>Newsletter signup is coming in a later module.</p>
    </section>
  );
}

// FR-16.9 - a reusable section type: seller-entered Q&A pairs, expand/
// collapse. Uses the browser's native <details>/<summary> - a real,
// functioning accordion with zero JS, consistent with "bare functional, no
// design pass yet."
export function FaqSection({ theme, items }: { theme: ResolvedThemeSettings; items: { question: string; answer: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
      <h2 style={{ color: theme.colors.primary }}>Frequently asked questions</h2>
      {items.map((item, index) => (
        <details key={index} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
