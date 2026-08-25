import { Space_Grotesk } from "next/font/google";
import { AnimatedElement } from "../../../components/motion/AnimatedElement";
import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";
import { DeliveryBadge } from "../delivery-badge";
import { DStudioSectionProps, TemplateSectionSet } from "./types";

/**
 * Studio - geometric/grotesque sans, bold color-blocking, confident large
 * type (docs/architecture.md's Template Package Spec). Premium built-in
 * template. D-Studio v1 variant/animation support: variant 0 is always
 * this template's pre-existing rendering.
 */
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-studio-display" });

function StudioHero({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const heading = (
    <AnimatedElement as="h1" preset={elementAnimations?.heading} className="text-6xl font-bold uppercase leading-none tracking-tight sm:text-8xl">
      <span style={{ fontFamily: "var(--font-studio-display)", color: theme.colors.primary }}>{store.name}</span>
    </AnimatedElement>
  );
  if (variant === 1 || variant === 2) {
    return (
      <section className={`${grotesk.variable} flex flex-col items-center gap-10 px-6 py-24 sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`} style={{ background: theme.colors.background, color: theme.colors.text }}>
        <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-square flex-1" style={{ background: `${theme.colors.primary}22` }} />
        <div className="flex-1">
          {heading}
          {store.seoDescription && <p className="mt-6 max-w-lg text-lg opacity-80">{store.seoDescription}</p>}
        </div>
      </section>
    );
  }
  if (variant === 3) {
    return (
      <section className={`${grotesk.variable} px-6 py-40`} style={{ background: "#0a0a0a", color: "#fff" }}>
        <div className="mx-auto max-w-5xl">
          {heading}
          {store.seoDescription && <p className="mt-6 max-w-lg text-lg opacity-80">{store.seoDescription}</p>}
        </div>
      </section>
    );
  }
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
        {heading}
        {store.seoDescription && <p className="mt-6 max-w-lg text-lg opacity-80">{store.seoDescription}</p>}
      </div>
    </section>
  );
}

function StudioFeaturedProducts({ products, theme, variant = 0, elementAnimations }: { products: PublicProduct[]; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const gridClass =
    variant === 1
      ? "grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-5"
      : variant === 2
        ? "flex gap-1 overflow-x-auto"
        : "grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4";
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <div className="mx-auto max-w-6xl">
        <AnimatedElement as="h2" preset={elementAnimations?.heading} className={`${grotesk.variable} mb-10 text-3xl font-bold uppercase tracking-tight`}>
          <span style={{ fontFamily: "var(--font-studio-display)" }}>Shop</span>
        </AnimatedElement>
        {products.length === 0 ? (
          <p className="opacity-70">No products yet.</p>
        ) : (
          <AnimatedElement as="div" preset={elementAnimations?.image} className={gridClass} options={{ staggerChildren: true }}>
            {products.map((product) => (
              <a
                key={product.id}
                href={`/products/${product.id}`}
                className={`block p-3 ${variant === 2 ? "min-w-[45%] sm:min-w-[24%]" : ""}`}
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
          </AnimatedElement>
        )}
      </div>
    </section>
  );
}

function StudioAbout({ store, theme, variant = 0, elementAnimations }: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const body = store.seoDescription ?? `${store.name} is a store on UZEYN.`;
  if (variant === 1 || variant === 2) {
    return (
      <section className={`flex flex-col items-center gap-10 px-6 py-24 sm:flex-row ${variant === 2 ? "sm:flex-row-reverse" : ""}`} style={{ background: theme.colors.primary, color: theme.colors.background }}>
        <AnimatedElement as="div" preset={elementAnimations?.image} className="aspect-square flex-1" style={{ background: `${theme.colors.background}22` }} />
        <div className="flex-1">
          <h2 className={`${grotesk.variable} mb-4 text-3xl font-bold uppercase tracking-tight`} style={{ fontFamily: "var(--font-studio-display)" }}>
            About {store.name}
          </h2>
          <p className="text-lg opacity-90">{body}</p>
        </div>
      </section>
    );
  }
  return (
    <section className="px-6 py-24" style={{ background: theme.colors.primary, color: theme.colors.background }}>
      <div className="mx-auto max-w-3xl">
        <AnimatedElement as="h2" preset={elementAnimations?.heading} className={`${grotesk.variable} mb-4 text-3xl font-bold uppercase tracking-tight`}>
          <span style={{ fontFamily: "var(--font-studio-display)" }}>About {store.name}</span>
        </AnimatedElement>
        <p className="text-lg opacity-90">{body}</p>
      </div>
    </section>
  );
}

function StudioNewsletter({ theme, variant = 0 }: { theme: ResolvedThemeSettings } & DStudioSectionProps) {
  const inner = (
    <>
      <h2 className={`${grotesk.variable} text-3xl font-bold uppercase tracking-tight`} style={{ fontFamily: "var(--font-studio-display)" }}>
        Stay updated
      </h2>
      <p className="mt-3 opacity-70">Newsletter signup is coming in a later module.</p>
    </>
  );
  if (variant === 1) {
    return (
      <section className="px-6 py-24 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
        <div className="mx-auto max-w-md border-2 p-10" style={{ borderColor: theme.colors.primary }}>{inner}</div>
      </section>
    );
  }
  if (variant === 2) {
    return (
      <section className="px-6 py-32 text-center" style={{ background: theme.colors.primary, color: theme.colors.background }}>
        {inner}
      </section>
    );
  }
  return (
    <section className="px-6 py-24 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      {inner}
    </section>
  );
}

function StudioFaq({ theme, items, variant = 0 }: { theme: ResolvedThemeSettings; items: FaqItem[] } & DStudioSectionProps) {
  if (items.length === 0) return null;
  const heading = (
    <h2 className={`${grotesk.variable} mb-8 text-3xl font-bold uppercase tracking-tight`} style={{ fontFamily: "var(--font-studio-display)" }}>
      FAQ
    </h2>
  );
  if (variant === 1) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
        {heading}
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item, index) => (
            <details key={index} style={{ borderBottom: `1px solid ${theme.colors.primary}33`, paddingBottom: 12 }}>
              <summary className="cursor-pointer font-bold">{item.question}</summary>
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
        <details key={index} className="mb-3" style={{ borderBottom: `1px solid ${theme.colors.primary}33`, paddingBottom: 12 }}>
          <summary className="cursor-pointer font-bold">{item.question}</summary>
          <p className="mt-2 opacity-80">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

export const studioSections: Pick<TemplateSectionSet, "Hero" | "FeaturedProducts" | "About" | "Newsletter" | "Faq"> = {
  Hero: StudioHero,
  FeaturedProducts: StudioFeaturedProducts,
  About: StudioAbout,
  Newsletter: StudioNewsletter,
  Faq: StudioFaq,
};
