import { Playfair_Display } from "next/font/google";
import { AnimatedElement } from "../../../components/motion/AnimatedElement";
import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { DStudioSectionProps, TemplateSectionSet } from "./types";

/**
 * Editorial - serif display type, generous whitespace, lifestyle
 * photography treatment (docs/architecture.md's Template Package Spec).
 * Default free built-in template.
 *
 * D-Studio v1 - each section now switches on `variant` (lib/section-
 * catalog.ts's per-section layout list); variant 0 is always this
 * template's pre-existing, unchanged rendering (backward compatibility for
 * every already-published store, which has no `variant` field at all and
 * so resolves to 0). `elementAnimations` wraps the heading/image/button in
 * AnimatedElement so a seller's chosen GSAP preset actually runs.
 */
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-editorial-display" });

function EditorialHero({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const heading = (
    <AnimatedElement as="h1" preset={elementAnimations?.heading} className="max-w-3xl text-5xl leading-tight tracking-tight sm:text-6xl">
      <span style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>{store.name}</span>
    </AnimatedElement>
  );
  const media = (
    <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-[4/3] w-full rounded-md bg-black/5" />
  );

  if (variant === 1 || variant === 2) {
    return (
      <section
        className={`${playfair.variable} flex flex-col items-center gap-10 px-6 py-20 sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`}
        style={{ background: theme.colors.background, color: theme.colors.text }}
      >
        <div className="flex-1">{media}</div>
        <div className="flex-1 text-center sm:text-left">
          {heading}
          {store.seoDescription && (
            <AnimatedElement as="p" preset={elementAnimations?.text} className="mt-6 max-w-xl text-lg opacity-80">
              {store.seoDescription}
            </AnimatedElement>
          )}
        </div>
      </section>
    );
  }
  if (variant === 3) {
    return (
      <section className={`${playfair.variable} relative px-6 py-32 text-center`} style={{ background: "#111", color: "#fff" }}>
        <AnimatedElement as="div" preset={elementAnimations?.image} className="absolute inset-0 opacity-40" >
          <div className="h-full w-full bg-black" />
        </AnimatedElement>
        <div className="relative">
          <AnimatedElement as="h1" preset={elementAnimations?.heading} className="mx-auto max-w-3xl text-5xl leading-tight tracking-tight sm:text-6xl">
            <span style={{ fontFamily: "var(--font-editorial-display)" }}>{store.name}</span>
          </AnimatedElement>
          {store.seoDescription && (
            <AnimatedElement as="p" preset={elementAnimations?.text} className="mx-auto mt-6 max-w-xl text-lg opacity-80">
              {store.seoDescription}
            </AnimatedElement>
          )}
        </div>
      </section>
    );
  }
  return (
    <section
      className={`${playfair.variable} px-6 py-28 text-center`}
      style={{ background: theme.colors.background, color: theme.colors.text }}
    >
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt={store.name} className="mx-auto mb-8 max-h-16" />
      )}
      <AnimatedElement as="h1" preset={elementAnimations?.heading} className="mx-auto max-w-3xl text-5xl leading-tight tracking-tight sm:text-6xl">
        <span style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>{store.name}</span>
      </AnimatedElement>
      {store.seoDescription && (
        <AnimatedElement as="p" preset={elementAnimations?.text} className="mx-auto mt-6 max-w-xl text-lg opacity-80">
          {store.seoDescription}
        </AnimatedElement>
      )}
    </section>
  );
}

function EditorialFeaturedProducts({ products, theme, variant = 0, elementAnimations }: { products: PublicProduct[]; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const gridClass =
    variant === 1
      ? "mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4"
      : variant === 2
        ? "mx-auto flex max-w-6xl gap-8 overflow-x-auto pb-2"
        : "mx-auto grid max-w-6xl grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className={`${playfair.variable} mb-10 text-center text-3xl`}>
        <span style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>The Collection</span>
      </AnimatedElement>
      {products.length === 0 ? (
        <p className="text-center opacity-70">No products yet.</p>
      ) : (
        <AnimatedElement as="div" preset={elementAnimations?.image} className={gridClass} options={{ staggerChildren: true }}>
          {products.map((product) => (
            <a key={product.id} href={`/products/${product.id}`} className={`group block ${variant === 2 ? "min-w-[45%] sm:min-w-[30%]" : ""}`} style={{ color: theme.colors.text, textDecoration: "none" }}>
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
        </AnimatedElement>
      )}
    </section>
  );
}

function EditorialAbout({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const body = store.seoDescription ?? `${store.name} is a store on UZEYN.`;
  if (variant === 1 || variant === 2) {
    return (
      <section
        className={`${playfair.variable} flex flex-col items-center gap-10 px-6 py-20 sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`}
        style={{ background: theme.colors.background, color: theme.colors.text }}
      >
        <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-[4/3] flex-1 rounded-md bg-black/5" />
        <div className="flex-1 text-center sm:text-left">
          <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-4 text-3xl">
            <span style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>About {store.name}</span>
          </AnimatedElement>
          <AnimatedElement as="p" preset={elementAnimations?.text} className="text-lg opacity-80">
            {body}
          </AnimatedElement>
        </div>
      </section>
    );
  }
  return (
    <section className="px-6 py-20 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className={`${playfair.variable} mb-4 text-3xl`}>
        <span style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>About {store.name}</span>
      </AnimatedElement>
      <AnimatedElement as="p" preset={elementAnimations?.text} className="mx-auto max-w-2xl text-lg opacity-80">
        {body}
      </AnimatedElement>
    </section>
  );
}

function EditorialNewsletter({ theme, variant = 0, elementAnimations }: { theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const heading = (
    <AnimatedElement as="h2" preset={elementAnimations?.heading} className={`${playfair.variable} text-3xl`}>
      <span style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>Stay updated</span>
    </AnimatedElement>
  );
  if (variant === 1) {
    return (
      <section className="px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
        <div className="mx-auto max-w-md rounded-lg border p-10 text-center" style={{ borderColor: `${theme.colors.text}1a` }}>
          {heading}
          <p className="mt-3 opacity-70">Newsletter signup is coming in a later module.</p>
        </div>
      </section>
    );
  }
  if (variant === 2) {
    return (
      <section className="px-6 py-28 text-center" style={{ background: theme.colors.primary, color: "#fff" }}>
        {heading}
        <p className="mt-3 opacity-80">Newsletter signup is coming in a later module.</p>
      </section>
    );
  }
  return (
    <section className="px-6 py-20 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      {heading}
      <p className="mt-3 opacity-70">Newsletter signup is coming in a later module.</p>
    </section>
  );
}

function EditorialFaq({ theme, items, variant = 0, elementAnimations }: { theme: ResolvedThemeSettings; items: FaqItem[] } & DStudioSectionProps) {
  if (items.length === 0) return null;
  const heading = (
    <AnimatedElement as="h2" preset={elementAnimations?.heading} className={`${playfair.variable} mb-8 text-center text-3xl`}>
      <span style={{ fontFamily: "var(--font-editorial-display)", color: theme.colors.primary }}>Questions</span>
    </AnimatedElement>
  );
  if (variant === 1) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
        {heading}
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item, index) => (
            <details key={index} className="border-b pb-4" style={{ borderColor: `${theme.colors.text}1a` }}>
              <summary className="cursor-pointer text-lg">{item.question}</summary>
              <p className="mt-2 opacity-80">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-2xl px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      {heading}
      {items.map((item, index) => (
        <details key={index} className="mb-4 border-b border-black/10 pb-4">
          <summary className="cursor-pointer text-lg">{item.question}</summary>
          <p className="mt-2 opacity-80">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const editorialSections: Pick<TemplateSectionSet, "Hero" | "FeaturedProducts" | "About" | "Newsletter" | "Faq"> = {
  Hero: EditorialHero,
  FeaturedProducts: EditorialFeaturedProducts,
  About: EditorialAbout,
  Newsletter: EditorialNewsletter,
  Faq: EditorialFaq,
};
