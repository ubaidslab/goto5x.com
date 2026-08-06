import { Playfair_Display } from "next/font/google";
import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { TemplateSectionSet } from "./types";

/**
 * Editorial - serif display type, generous whitespace, lifestyle
 * photography treatment (docs/architecture.md's Template Package Spec).
 * Default free built-in template.
 */
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-editorial-display" });

function EditorialHero({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section
      className={`${playfair.variable} px-6 py-28 text-center`}
      style={{ background: theme.colors.background, color: theme.colors.text }}
    >
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt={store.name} className="mx-auto mb-8 max-h-16" />
      )}
      <h1 className="mx-auto max-w-3xl text-5xl leading-tight tracking-tight sm:text-6xl" style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>
        {store.name}
      </h1>
      {store.seoDescription && <p className="mx-auto mt-6 max-w-xl text-lg opacity-80">{store.seoDescription}</p>}
    </section>
  );
}

function EditorialFeaturedProducts({ products, theme }: { products: PublicProduct[]; theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2
        className={`${playfair.variable} mb-10 text-center text-3xl`}
        style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}
      >
        The Collection
      </h2>
      {products.length === 0 ? (
        <p className="text-center opacity-70">No products yet.</p>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <a key={product.id} href={`/products/${product.id}`} className="group block" style={{ color: theme.colors.text, textDecoration: "none" }}>
              {product.media[0] && (
                <div className="mb-4 aspect-[4/5] overflow-hidden bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.media[0].url}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <h3 className="text-lg" style={{ fontFamily: "var(--font-editorial-display)" }}>
                {product.title}
              </h3>
              {product.variants[0] && <p className="mt-1 text-sm opacity-70">{product.variants[0].price}</p>}
              <DeliveryBadge supplierShipping={product.supplierShipping} theme={theme} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function EditorialAbout({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-20 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className={`${playfair.variable} mb-4 text-3xl`} style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>
        About {store.name}
      </h2>
      <p className="mx-auto max-w-2xl text-lg opacity-80">{store.seoDescription ?? `${store.name} is a store on UZEYN.`}</p>
    </section>
  );
}

function EditorialNewsletter({ theme }: { theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-20 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className={`${playfair.variable} text-3xl`} style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>
        Stay updated
      </h2>
      <p className="mt-3 opacity-70">Newsletter signup is coming in a later module.</p>
    </section>
  );
}

function EditorialFaq({ theme, items }: { theme: ResolvedThemeSettings; items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-2xl px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className={`${playfair.variable} mb-8 text-center text-3xl`} style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>
        Questions
      </h2>
      {items.map((item, index) => (
        <details key={index} className="mb-4 border-b border-black/10 pb-4">
          <summary className="cursor-pointer text-lg">{item.question}</summary>
          <p className="mt-2 opacity-80">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const editorialSections: TemplateSectionSet = {
  Hero: EditorialHero,
  FeaturedProducts: EditorialFeaturedProducts,
  About: EditorialAbout,
  Newsletter: EditorialNewsletter,
  Faq: EditorialFaq,
};
