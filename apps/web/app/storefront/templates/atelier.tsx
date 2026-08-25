import { AnimatedElement } from "../../../components/motion/AnimatedElement";
import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { DStudioSectionProps, TemplateSectionSet } from "./types";

/**
 * Atelier - monochrome, minimal, restrained single accent (apple.com
 * discipline - docs/architecture.md's Template Package Spec). Free built-in
 * template. D-Studio v1 variant/animation support follows the same
 * "variant 0 = pre-existing rendering, unchanged" rule as editorial.tsx.
 */
function AtelierHero({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const heading = (
    <AnimatedElement as="h1" preset={elementAnimations?.heading} className="text-4xl font-medium tracking-tight sm:text-5xl">
      {store.name}
    </AnimatedElement>
  );
  if (variant === 1 || variant === 2) {
    return (
      <section
        className={`flex flex-col items-center gap-10 px-6 py-24 [font-family:var(--font-geist-sans)] sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`}
        style={{ background: theme.colors.background, color: theme.colors.text }}
      >
        <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-[4/3] flex-1 bg-black/5" />
        <div className="flex-1 text-center sm:text-left">
          {heading}
          {store.seoDescription && (
            <AnimatedElement as="p" preset={elementAnimations?.text} className="mt-4 max-w-md text-base opacity-60">
              {store.seoDescription}
            </AnimatedElement>
          )}
        </div>
      </section>
    );
  }
  if (variant === 3) {
    return (
      <section className="px-6 py-40 text-center [font-family:var(--font-geist-sans)]" style={{ background: "#0a0a0a", color: "#fff" }}>
        <AnimatedElement as="h1" preset={elementAnimations?.heading} className="text-4xl font-medium tracking-tight sm:text-5xl">
          {store.name}
        </AnimatedElement>
        {store.seoDescription && (
          <AnimatedElement as="p" preset={elementAnimations?.text} className="mx-auto mt-4 max-w-md text-base opacity-60">
            {store.seoDescription}
          </AnimatedElement>
        )}
      </section>
    );
  }
  return (
    <section
      className="px-6 py-40 text-center [font-family:var(--font-geist-sans)]"
      style={{ background: theme.colors.background, color: theme.colors.text }}
    >
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt={store.name} className="mx-auto mb-10 max-h-12" />
      )}
      {heading}
      {store.seoDescription && (
        <AnimatedElement as="p" preset={elementAnimations?.text} className="mx-auto mt-4 max-w-md text-base opacity-60">
          {store.seoDescription}
        </AnimatedElement>
      )}
    </section>
  );
}

function AtelierFeaturedProducts({ products, theme, variant = 0, elementAnimations }: { products: PublicProduct[]; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const gridClass =
    variant === 1
      ? "mx-auto grid max-w-5xl grid-cols-2 gap-x-8 gap-y-16 sm:grid-cols-4"
      : variant === 2
        ? "mx-auto flex max-w-5xl gap-8 overflow-x-auto pb-2"
        : "mx-auto grid max-w-5xl grid-cols-2 gap-x-8 gap-y-16 sm:grid-cols-3";
  return (
    <section className="px-6 py-24 [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mx-auto mb-8 max-w-5xl text-sm font-medium uppercase tracking-widest opacity-50">
        Shop
      </AnimatedElement>
      {products.length === 0 ? (
        <p className="text-center opacity-60">No products yet.</p>
      ) : (
        <AnimatedElement as="div" preset={elementAnimations?.image} className={gridClass} options={{ staggerChildren: true }}>
          {products.map((product) => (
            <a key={product.id} href={`/products/${product.id}`} className={`block ${variant === 2 ? "min-w-[45%] sm:min-w-[28%]" : ""}`} style={{ color: theme.colors.text, textDecoration: "none" }}>
              {product.media[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.media[0].url} alt={product.title} className="mb-4 aspect-square w-full object-cover" />
              )}
              <h3 className="text-sm font-medium">{product.title}</h3>
              {product.variants[0] && <p className="mt-1 text-sm opacity-60">{product.variants[0].price}</p>}
              <DeliveryBadge supplierShipping={product.supplierShipping} theme={theme} />
            </a>
          ))}
        </AnimatedElement>
      )}
    </section>
  );
}

function AtelierAbout({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const body = store.seoDescription ?? `${store.name} is a store on UZEYN.`;
  if (variant === 1 || variant === 2) {
    return (
      <section
        className={`flex flex-col items-center gap-10 px-6 py-24 [font-family:var(--font-geist-sans)] sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`}
        style={{ background: theme.colors.background, color: theme.colors.text }}
      >
        <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-[4/3] flex-1 bg-black/5" />
        <div className="flex-1 text-center sm:text-left">
          <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-3 text-sm font-medium uppercase tracking-widest opacity-50">
            About
          </AnimatedElement>
          <AnimatedElement as="p" preset={elementAnimations?.text} className="text-lg">
            {body}
          </AnimatedElement>
        </div>
      </section>
    );
  }
  return (
    <section className="px-6 py-24 text-center [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-3 text-sm font-medium uppercase tracking-widest opacity-50">
        About
      </AnimatedElement>
      <AnimatedElement as="p" preset={elementAnimations?.text} className="mx-auto max-w-xl text-lg">
        {body}
      </AnimatedElement>
    </section>
  );
}

function AtelierNewsletter({ theme, variant = 0, elementAnimations }: { theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const inner = (
    <>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="text-sm font-medium uppercase tracking-widest opacity-50">
        Stay updated
      </AnimatedElement>
      <p className="mt-3 text-sm opacity-60">Newsletter signup is coming in a later module.</p>
    </>
  );
  if (variant === 1) {
    return (
      <section className="px-6 py-24 [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
        <div className="mx-auto max-w-sm border p-10 text-center" style={{ borderColor: `${theme.colors.text}1a` }}>{inner}</div>
      </section>
    );
  }
  if (variant === 2) {
    return (
      <section className="px-6 py-32 text-center [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.text, color: theme.colors.background }}>
        {inner}
      </section>
    );
  }
  return (
    <section className="px-6 py-24 text-center [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      {inner}
    </section>
  );
}

function AtelierFaq({ theme, items, variant = 0, elementAnimations }: { theme: ResolvedThemeSettings; items: FaqItem[] } & DStudioSectionProps) {
  if (items.length === 0) return null;
  const heading = (
    <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-8 text-center text-sm font-medium uppercase tracking-widest opacity-50">
      Questions
    </AnimatedElement>
  );
  if (variant === 1) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-24 [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
        {heading}
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item, index) => (
            <details key={index} className="border-b pb-4" style={{ borderColor: `${theme.colors.text}1a` }}>
              <summary className="cursor-pointer text-sm font-medium">{item.question}</summary>
              <p className="mt-2 text-sm opacity-70">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-xl px-6 py-24 [font-family:var(--font-geist-sans)]" style={{ background: theme.colors.background, color: theme.colors.text }}>
      {heading}
      {items.map((item, index) => (
        <details key={index} className="mb-4 border-b pb-4" style={{ borderColor: `${theme.colors.text}1a` }}>
          <summary className="cursor-pointer text-sm font-medium">{item.question}</summary>
          <p className="mt-2 text-sm opacity-70">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const atelierSections: Pick<TemplateSectionSet, "Hero" | "FeaturedProducts" | "About" | "Newsletter" | "Faq"> = {
  Hero: AtelierHero,
  FeaturedProducts: AtelierFeaturedProducts,
  About: AtelierAbout,
  Newsletter: AtelierNewsletter,
  Faq: AtelierFaq,
};
