import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { TemplateSectionSet } from "./types";

/**
 * Market - denser grid, utilitarian, optimized for scanning many SKUs
 * quickly (docs/architecture.md's Template Package Spec). Reuses the
 * platform's own Inter body face (already loaded app-wide) rather than a
 * new display font - a dense, no-frills catalog reads best with a single,
 * highly legible face at every size. Premium built-in template.
 */
function MarketHero({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section className="flex items-center justify-between gap-6 border-b px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      <div className="flex items-center gap-4">
        {theme.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logoUrl} alt={store.name} className="h-10" />
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
      </div>
      {store.seoDescription && <p className="hidden max-w-sm text-sm opacity-70 sm:block">{store.seoDescription}</p>}
    </section>
  );
}

function MarketFeaturedProducts({ products, theme }: { products: PublicProduct[]; theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide opacity-60">All products</h2>
      {products.length === 0 ? (
        <p className="opacity-70">No products yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              className="block rounded-sm"
              style={{ color: theme.colors.text, textDecoration: "none", border: `1px solid ${theme.colors.text}1a` }}
            >
              {product.media[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.media[0].url} alt={product.title} className="h-28 w-full object-cover" />
              )}
              <div className="p-2">
                <h3 className="truncate text-sm">{product.title}</h3>
                {product.variants[0] && <p className="text-sm font-semibold" style={{ color: theme.colors.primary }}>{product.variants[0].price}</p>}
                <DeliveryBadge supplierShipping={product.supplierShipping} theme={theme} />
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function MarketAbout({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">About {store.name}</h2>
      <p className="text-sm opacity-80">{store.seoDescription ?? `${store.name} is a store on UZEYN.`}</p>
    </section>
  );
}

function MarketNewsletter({ theme }: { theme: ResolvedThemeSettings }) {
  return (
    <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Stay updated</h2>
      <p className="mt-2 text-sm opacity-70">Newsletter signup is coming in a later module.</p>
    </section>
  );
}

function MarketFaq({ theme, items }: { theme: ResolvedThemeSettings; items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide opacity-60">FAQ</h2>
      {items.map((item, index) => (
        <details key={index} className="mb-2 border-b pb-2 text-sm" style={{ borderColor: `${theme.colors.text}1a` }}>
          <summary className="cursor-pointer font-medium">{item.question}</summary>
          <p className="mt-1 opacity-80">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const marketSections: TemplateSectionSet = {
  Hero: MarketHero,
  FeaturedProducts: MarketFeaturedProducts,
  About: MarketAbout,
  Newsletter: MarketNewsletter,
  Faq: MarketFaq,
};
