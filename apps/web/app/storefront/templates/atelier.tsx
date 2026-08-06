import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { TemplateSectionSet } from "./types";

/**
 * Atelier - monochrome, minimal, restrained single accent (apple.com
 * discipline - docs/architecture.md's Template Package Spec). Reuses the
 * platform's own Geist display face (already loaded app-wide), the same
 * "confident, no personality tax" reasoning the dashboard/marketing pages
 * use it for. Free built-in template.
 */
function AtelierHero({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section
      className="px-6 py-40 text-center [font-family:var(--font-geist-sans)]"
      style={{ background: theme.colors.background, color: theme.colors.text }}
    >
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt={store.name} className="mx-auto mb-10 max-h-12" />
      )}
      <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">{store.name}</h1>
      {store.seoDescription && <p className="mx-auto mt-4 max-w-md text-base opacity-60">{store.seoDescription}</p>}
    </section>
  );
}

function AtelierFeaturedProducts({ products, theme }: { products: PublicProduct[]; theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-24 [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      {products.length === 0 ? (
        <p className="text-center opacity-60">No products yet.</p>
      ) : (
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-8 gap-y-16 sm:grid-cols-3">
          {products.map((product) => (
            <a key={product.id} href={`/products/${product.id}`} className="block" style={{ color: theme.colors.text, textDecoration: "none" }}>
              {product.media[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.media[0].url} alt={product.title} className="mb-4 aspect-square w-full object-cover" />
              )}
              <h3 className="text-sm font-medium">{product.title}</h3>
              {product.variants[0] && <p className="mt-1 text-sm opacity-60">{product.variants[0].price}</p>}
              <DeliveryBadge supplierShipping={product.supplierShipping} theme={theme} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function AtelierAbout({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-24 text-center [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-widest opacity-50">About</h2>
      <p className="mx-auto max-w-xl text-lg">{store.seoDescription ?? `${store.name} is a store on UZEYN.`}</p>
    </section>
  );
}

function AtelierNewsletter({ theme }: { theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-24 text-center [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className="text-sm font-medium uppercase tracking-widest opacity-50">Stay updated</h2>
      <p className="mt-3 text-sm opacity-60">Newsletter signup is coming in a later module.</p>
    </section>
  );
}

function AtelierFaq({ theme, items }: { theme: ResolvedThemeSettings; items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-xl px-6 py-24 [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className="mb-8 text-center text-sm font-medium uppercase tracking-widest opacity-50">Questions</h2>
      {items.map((item, index) => (
        <details key={index} className="mb-4 border-b pb-4" style={{ borderColor: `${theme.colors.text}1a` }}>
          <summary className="cursor-pointer text-sm font-medium">{item.question}</summary>
          <p className="mt-2 text-sm opacity-70">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const atelierSections: TemplateSectionSet = {
  Hero: AtelierHero,
  FeaturedProducts: AtelierFeaturedProducts,
  About: AtelierAbout,
  Newsletter: AtelierNewsletter,
  Faq: AtelierFaq,
};
