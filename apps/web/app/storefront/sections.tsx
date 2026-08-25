import { AnimatedElement } from "../../components/motion/AnimatedElement";
import { PublicProduct, PublicStore } from "../../lib/storefront-api";
import { DStudioSectionProps } from "./templates/types";
import { ResolvedThemeSettings } from "../../lib/theme-presets";
import { DeliveryBadge } from "./delivery-badge";

/**
 * "Start from blank"'s section set - deliberately the plainest rendering,
 * since blank-start is about an empty section LIST the seller composes
 * from scratch, never a competing visual identity of its own. D-Studio v1
 * (founder directive: "Blank-start gets the same premium Studio treatment,
 * section-catalog-driven") still gives it real variant + per-element
 * animation support - variant 0 stays this file's original bare rendering.
 */
export function HeroSection({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const heading = (
    <AnimatedElement as="h1" preset={elementAnimations?.heading} style={{ color: theme.colors.primary }}>
      {store.name}
    </AnimatedElement>
  );
  if (variant === 1 || variant === 2) {
    return (
      <section style={{ display: "flex", flexDirection: variant === 2 ? "row-reverse" : "row", alignItems: "center", gap: 24, padding: "48px 24px", background: theme.colors.background, color: theme.colors.text }}>
        <AnimatedElement as="div" preset={elementAnimations?.image} style={{ flex: 1, aspectRatio: "4/3", background: "#eee" }} />
        <div style={{ flex: 1 }}>
          {heading}
          {store.seoDescription && (
        <AnimatedElement as="p" preset={elementAnimations?.text}>
          {store.seoDescription}
        </AnimatedElement>
      )}
        </div>
      </section>
    );
  }
  return (
    <section style={{ padding: "64px 24px", textAlign: "center", background: theme.colors.background, color: theme.colors.text }}>
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt={store.name} style={{ maxHeight: 64 }} />
      )}
      {heading}
      {store.seoDescription && (
        <AnimatedElement as="p" preset={elementAnimations?.text}>
          {store.seoDescription}
        </AnimatedElement>
      )}
    </section>
  );
}

export function FeaturedProductsSection({ products, theme, variant = 0, elementAnimations }: { products: PublicProduct[]; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const columns = variant === 1 ? "repeat(auto-fill, minmax(140px, 1fr))" : "repeat(auto-fill, minmax(200px, 1fr))";
  return (
    <section style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} style={{ color: theme.colors.primary }}>
        Products
      </AnimatedElement>
      {products.length === 0 ? (
        <p>No products yet.</p>
      ) : variant === 2 ? (
        <AnimatedElement as="div" preset={elementAnimations?.image} style={{ display: "flex", gap: 16, overflowX: "auto" }} options={{ staggerChildren: true }}>
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              style={{ color: theme.colors.text, textDecoration: "none", border: "1px solid #e5e7eb", padding: 12, borderRadius: 8, minWidth: 180, flexShrink: 0 }}
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
        </AnimatedElement>
      ) : (
        <AnimatedElement as="div" preset={elementAnimations?.image} style={{ display: "grid", gridTemplateColumns: columns, gap: 16 }} options={{ staggerChildren: true }}>
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
        </AnimatedElement>
      )}
    </section>
  );
}

export function AboutSection({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const body = store.seoDescription ?? `${store.name} is a store on uzeyn.com.`;
  if (variant === 1 || variant === 2) {
    return (
      <section style={{ display: "flex", flexDirection: variant === 2 ? "row-reverse" : "row", alignItems: "center", gap: 24, padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
        <AnimatedElement as="div" preset={elementAnimations?.image} style={{ flex: 1, aspectRatio: "4/3", background: "#eee" }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ color: theme.colors.primary }}>About {store.name}</h2>
          <AnimatedElement as="p" preset={elementAnimations?.text}>
        {body}
      </AnimatedElement>
        </div>
      </section>
    );
  }
  return (
    <section style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} style={{ color: theme.colors.primary }}>
        About {store.name}
      </AnimatedElement>
      <AnimatedElement as="p" preset={elementAnimations?.text}>
        {body}
      </AnimatedElement>
    </section>
  );
}

export function NewsletterSection({ theme, variant = 0, elementAnimations }: { theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const inner = (
    <>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} style={{ color: theme.colors.primary }}>
        Stay updated
      </AnimatedElement>
      <p>Newsletter signup is coming in a later module.</p>
    </>
  );
  if (variant === 1) {
    return (
      <section style={{ padding: "32px 24px", textAlign: "center", background: theme.colors.background, color: theme.colors.text }}>
        <div style={{ maxWidth: 360, margin: "0 auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24 }}>{inner}</div>
      </section>
    );
  }
  if (variant === 2) {
    return (
      <section style={{ padding: "48px 24px", textAlign: "center", background: theme.colors.primary, color: "#fff" }}>
        {inner}
      </section>
    );
  }
  return (
    <section style={{ padding: "32px 24px", textAlign: "center", background: theme.colors.background, color: theme.colors.text }}>
      {inner}
    </section>
  );
}

// FR-16.9 - a reusable section type: seller-entered Q&A pairs, expand/
// collapse. Uses the browser's native <details>/<summary> - a real,
// functioning accordion with zero JS, consistent with "bare functional, no
// design pass yet."
export function FaqSection({ theme, items, variant = 0, elementAnimations }: { theme: ResolvedThemeSettings; items: { question: string; answer: string }[] } & DStudioSectionProps) {
  if (items.length === 0) return null;
  const heading = (
    <AnimatedElement as="h2" preset={elementAnimations?.heading} style={{ color: theme.colors.primary }}>
      Frequently asked questions
    </AnimatedElement>
  );
  if (variant === 1) {
    return (
      <section style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
        {heading}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {items.map((item, index) => (
            <details key={index}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section style={{ padding: "32px 24px", background: theme.colors.background, color: theme.colors.text }}>
      {heading}
      {items.map((item, index) => (
        <details key={index} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}
