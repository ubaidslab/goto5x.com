import { Space_Grotesk } from "next/font/google";
import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { TemplateSectionSet } from "./types";

/**
 * Studio - geometric/grotesque sans, bold color-blocking, confident large
 * type (docs/architecture.md's Template Package Spec). Premium built-in
 * template.
 */
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-studio-display" });

function StudioHero({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section
      className={`${grotesk.variable} px-6 py-32`}
      style={{ background: theme.colors.background, color: theme.colors.text }}
    >
      <div className="mx-auto max-w-5xl">
        {theme.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logoUrl} alt={store.name} className="mb-8 max-h-14" />
        )}
        <h1
          className="text-6xl font-bold uppercase leading-none tracking-tight sm:text-8xl"
          style={{ fontFamily: "var(--font-studio-display)", color: theme.colors.primary }}
        >
          {store.name}
        </h1>
        {store.seoDescription && <p className="mt-6 max-w-lg text-lg opacity-80">{store.seoDescription}</p>}
      </div>
    </section>
  );
}

function StudioFeaturedProducts({ products, theme }: { products: PublicProduct[]; theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <div className="mx-auto max-w-6xl">
        <h2
          className={`${grotesk.variable} mb-10 text-3xl font-bold uppercase tracking-tight`}
          style={{ fontFamily: "var(--font-studio-display)" }}
        >
          Shop
        </h2>
        {products.length === 0 ? (
          <p className="opacity-70">No products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <a
                key={product.id}
                href={`/products/${product.id}`}
                className="block p-3"
                style={{ color: theme.colors.text, textDecoration: "none", border: `1px solid ${theme.colors.primary}33` }}
              >
                {product.media[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.media[0].url} alt={product.title} className="mb-3 h-40 w-full object-cover" />
                )}
                <h3 className="text-sm font-bold uppercase tracking-wide">{product.title}</h3>
                {product.variants[0] && <p className="mt-1 text-sm" style={{ color: theme.colors.primary }}>{product.variants[0].price}</p>}
                <DeliveryBadge supplierShipping={product.supplierShipping} theme={theme} />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StudioAbout({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-24" style={{ background: theme.colors.primary, color: theme.colors.background }}>
      <div className="mx-auto max-w-3xl">
        <h2 className={`${grotesk.variable} mb-4 text-3xl font-bold uppercase tracking-tight`} style={{ fontFamily: "var(--font-studio-display)" }}>
          About {store.name}
        </h2>
        <p className="text-lg opacity-90">{store.seoDescription ?? `${store.name} is a store on eyosto.`}</p>
      </div>
    </section>
  );
}

function StudioNewsletter({ theme }: { theme: ResolvedThemeSettings }) {
  return (
    <section className="px-6 py-24 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className={`${grotesk.variable} text-3xl font-bold uppercase tracking-tight`} style={{ fontFamily: "var(--font-studio-display)" }}>
        Stay updated
      </h2>
      <p className="mt-3 opacity-70">Newsletter signup is coming in a later module.</p>
    </section>
  );
}

function StudioFaq({ theme, items }: { theme: ResolvedThemeSettings; items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-2xl px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <h2 className={`${grotesk.variable} mb-8 text-3xl font-bold uppercase tracking-tight`} style={{ fontFamily: "var(--font-studio-display)" }}>
        FAQ
      </h2>
      {items.map((item, index) => (
        <details key={index} className="mb-3" style={{ borderBottom: `1px solid ${theme.colors.primary}33`, paddingBottom: 12 }}>
          <summary className="cursor-pointer font-bold">{item.question}</summary>
          <p className="mt-2 opacity-80">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const studioSections: TemplateSectionSet = {
  Hero: StudioHero,
  FeaturedProducts: StudioFeaturedProducts,
  About: StudioAbout,
  Newsletter: StudioNewsletter,
  Faq: StudioFaq,
};
