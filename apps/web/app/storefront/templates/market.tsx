import { AnimatedElement } from "../../../components/motion/AnimatedElement";
import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { DStudioSectionProps, TemplateSectionSet } from "./types";

/**
 * Market - denser grid, utilitarian, optimized for scanning many SKUs
 * quickly (docs/architecture.md's Template Package Spec). Premium built-in
 * template. D-Studio v1 variant/animation support: variant 0 is always
 * this template's pre-existing rendering.
 */
function MarketHero({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  if (variant === 1 || variant === 2) {
    return (
      <section className={`flex flex-col items-center gap-8 border-b px-6 py-14 sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`} style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
        <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-video flex-1" style={{ background: `${theme.colors.text}0d` }} />
        <div className="flex-1">
          <AnimatedElement as="h1" preset={elementAnimations?.heading} className="text-2xl font-semibold tracking-tight">
            {store.name}
          </AnimatedElement>
          {store.seoDescription && <p className="mt-2 text-sm opacity-70">{store.seoDescription}</p>}
        </div>
      </section>
    );
  }
  if (variant === 3) {
    return (
      <section className="border-b px-6 py-20 text-center" style={{ background: "#0a0a0a", color: "#fff", borderColor: `${theme.colors.text}1a` }}>
        <AnimatedElement as="h1" preset={elementAnimations?.heading} className="text-2xl font-semibold tracking-tight">
          {store.name}
        </AnimatedElement>
        {store.seoDescription && <p className="mx-auto mt-2 max-w-sm text-sm opacity-70">{store.seoDescription}</p>}
      </section>
    );
  }
  return (
    <section className="flex items-center justify-between gap-6 border-b px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      <div className="flex items-center gap-4">
        {theme.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logoUrl} alt={store.name} className="h-10" />
        )}
        <AnimatedElement as="h1" preset={elementAnimations?.heading} className="text-2xl font-semibold tracking-tight">
          {store.name}
        </AnimatedElement>
      </div>
      {store.seoDescription && <p className="hidden max-w-sm text-sm opacity-70 sm:block">{store.seoDescription}</p>}
    </section>
  );
}

function MarketFeaturedProducts({ products, theme, variant = 0, elementAnimations }: { products: PublicProduct[]; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const gridClass =
    variant === 1
      ? "grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-8"
      : variant === 2
        ? "flex gap-4 overflow-x-auto"
        : "grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6";
  return (
    <section className="px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-6 text-sm font-semibold uppercase tracking-wide opacity-60">
        All products
      </AnimatedElement>
      {products.length === 0 ? (
        <p className="opacity-70">No products yet.</p>
      ) : (
        <AnimatedElement as="div" preset={elementAnimations?.image} className={gridClass} options={{ staggerChildren: true }}>
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              className={`block rounded-sm ${variant === 2 ? "min-w-[40%] sm:min-w-[18%]" : ""}`}
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
        </AnimatedElement>
      )}
    </section>
  );
}

function MarketAbout({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const body = store.seoDescription ?? `${store.name} is a store on UZEYN.`;
  if (variant === 1 || variant === 2) {
    return (
      <section className={`flex flex-col items-center gap-8 border-t px-6 py-10 sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`} style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
        <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-video flex-1" style={{ background: `${theme.colors.text}0d` }} />
        <div className="flex-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">About {store.name}</h2>
          <p className="text-sm opacity-80">{body}</p>
        </div>
      </section>
    );
  }
  return (
    <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">
        About {store.name}
      </AnimatedElement>
      <p className="text-sm opacity-80">{body}</p>
    </section>
  );
}

function MarketNewsletter({ theme, variant = 0 }: { theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const inner = (
    <>
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Stay updated</h2>
      <p className="mt-2 text-sm opacity-70">Newsletter signup is coming in a later module.</p>
    </>
  );
  if (variant === 1) {
    return (
      <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
        <div className="mx-auto max-w-sm rounded-sm border p-6 text-center" style={{ borderColor: `${theme.colors.text}1a` }}>{inner}</div>
      </section>
    );
  }
  if (variant === 2) {
    return (
      <section className="px-6 py-16 text-center" style={{ background: theme.colors.primary, color: "#fff" }}>
        {inner}
      </section>
    );
  }
  return (
    <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      {inner}
    </section>
  );
}

function MarketFaq({ theme, items, variant = 0 }: { theme: ResolvedThemeSettings; items: FaqItem[] } & DStudioSectionProps) {
  if (items.length === 0) return null;
  const heading = <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide opacity-60">FAQ</h2>;
  if (variant === 1) {
    return (
      <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
        {heading}
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item, index) => (
            <details key={index} className="border-b pb-2 text-sm" style={{ borderColor: `${theme.colors.text}1a` }}>
              <summary className="cursor-pointer font-medium">{item.question}</summary>
              <p className="mt-1 opacity-80">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="border-t px-6 py-10" style={{ background: theme.colors.background, color: theme.colors.text, borderColor: `${theme.colors.text}1a` }}>
      {heading}
      {items.map((item, index) => (
        <details key={index} className="mb-2 border-b pb-2 text-sm" style={{ borderColor: `${theme.colors.text}1a` }}>
          <summary className="cursor-pointer font-medium">{item.question}</summary>
          <p className="mt-1 opacity-80">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const marketSections: Pick<TemplateSectionSet, "Hero" | "FeaturedProducts" | "About" | "Newsletter" | "Faq"> = {
  Hero: MarketHero,
  FeaturedProducts: MarketFeaturedProducts,
  About: MarketAbout,
  Newsletter: MarketNewsletter,
  Faq: MarketFaq,
};
