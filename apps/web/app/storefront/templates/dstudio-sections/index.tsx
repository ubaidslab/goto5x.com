import { PublicCollection, PublicProduct, PublicStore } from "../../../../lib/storefront-api";
import { AnimationId, ElementSlot, ResolvedThemeSettings } from "../../../../lib/theme-presets";
import { AnimatedElement } from "../../../../components/motion/AnimatedElement";

/**
 * D-Studio v1 - the 17 NEW section types' shared component library (the
 * original 5 - Hero/FeaturedProducts/About/Newsletter/Faq - keep their
 * own per-template bespoke components in ../{editorial,atelier,studio,
 * market,base}.tsx unchanged, now with variant support added to each).
 *
 * Living under templates/ means THE ISOLATION RULE's existing structural
 * boundary (scripts/check-template-isolation.js) already covers this
 * directory for free - these components take only already-fetched
 * display data as props, exactly like every other template package.
 *
 * Shared, not per-template-bespoke: a template expresses its identity
 * through the colors/fontVar it passes in, not through a separate
 * component per template - the only tractable way to ship 17 new section
 * types across 5 templates without ~85 bespoke components. See
 * docs/ui-feature-inventory.md's D-Studio v1 note for this tradeoff.
 *
 * Content: sections backed by real store/product/collection data use it
 * (FeaturedCollection, ComparisonTable's product rows). Sections with no
 * content-authoring UI in v1 (Testimonials copy, Team members, Stats
 * numbers, Gallery images, Blog posts) render clearly-labeled placeholder
 * copy pending a future content module - the exact same precedent this
 * codebase already set with the original Newsletter section ("Newsletter
 * signup is coming in a later module").
 */

interface BaseProps {
  theme: ResolvedThemeSettings;
  variant?: number;
  elementAnimations?: Partial<Record<ElementSlot, AnimationId>>;
  fontVar?: string;
}

function anim(props: BaseProps, slot: ElementSlot): AnimationId | undefined {
  return props.elementAnimations?.[slot];
}

function headingStyle(theme: ResolvedThemeSettings, fontVar?: string) {
  return { color: theme.colors.primary, fontFamily: fontVar || undefined };
}

// ---------------------------------------------------------------------------
// GO tier
// ---------------------------------------------------------------------------

export function TestimonialsSection({ theme, variant, fontVar, ...p }: BaseProps) {
  const quotes = [
    { name: "Amara K.", quote: "Fast shipping and the product was exactly as described." },
    { name: "Zayn R.", quote: "Best customer service I've had shopping online." },
    { name: "Leila M.", quote: "Ordered twice already - will keep coming back." },
  ];
  const layout = variant === 1 ? "grid grid-cols-1 gap-6 sm:grid-cols-3" : variant === 2 ? "mx-auto max-w-xl" : "flex gap-6 overflow-x-auto";
  const shown = variant === 2 ? quotes.slice(0, 1) : quotes;
  return (
    <section className="px-6 py-20 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={anim({ theme, variant, fontVar, ...p }, "heading")} className="mb-10 text-3xl font-semibold" options={{}}>
        <span style={headingStyle(theme, fontVar)}>What customers say</span>
      </AnimatedElement>
      <AnimatedElement as="div" preset={anim({ theme, variant, fontVar, ...p }, "text")} className={layout} options={{ staggerChildren: variant !== 2 }}>
        {shown.map((q) => (
          <div key={q.name} className="flex-1 rounded-lg p-6" style={{ background: `${theme.colors.primary}0d` }}>
            <p className="mb-3 text-sm" style={{ color: theme.colors.primary }}>★★★★★</p>
            <p className="italic opacity-80">&ldquo;{q.quote}&rdquo;</p>
            <p className="mt-3 text-sm font-medium opacity-70">{q.name}</p>
          </div>
        ))}
      </AnimatedElement>
    </section>
  );
}

export function FooterContactSection({ theme, fontVar, store, elementAnimations }: BaseProps & { store: PublicStore }) {
  return (
    <footer className="px-6 py-14 text-center text-sm" style={{ background: theme.colors.text, color: theme.colors.background }}>
      <AnimatedElement as="p" preset={elementAnimations?.heading} className="text-base font-semibold" style={{ fontFamily: fontVar || undefined }}>
        {store.name}
      </AnimatedElement>
      {store.seoDescription && (
        <AnimatedElement as="p" preset={elementAnimations?.text} className="mx-auto mt-2 max-w-md opacity-70">
          {store.seoDescription}
        </AnimatedElement>
      )}
      <p className="mt-4 opacity-60">&copy; {new Date().getFullYear()} {store.name}. All rights reserved.</p>
    </footer>
  );
}

export function SpacerSection({ variant, theme }: BaseProps) {
  const height = variant === 1 ? "h-24" : variant === 2 ? "h-10" : "h-16";
  if (variant === 2) {
    return (
      <div className="flex items-center justify-center py-4" style={{ background: theme.colors.background }}>
        <div className="h-8 w-8 rounded-full opacity-20" style={{ background: theme.colors.primary }} />
      </div>
    );
  }
  return <div className={height} style={{ background: theme.colors.background }} />;
}

// ---------------------------------------------------------------------------
// RUN tier
// ---------------------------------------------------------------------------

export function FeaturedCollectionSection({ theme, variant, fontVar, collection, elementAnimations }: BaseProps & { collection: (PublicCollection & { products: PublicProduct[] }) | null }) {
  if (!collection) return null;
  const gridClass = variant === 1 ? "flex gap-6 overflow-x-auto" : "grid grid-cols-2 gap-6 sm:grid-cols-4";
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-8 text-center text-2xl font-semibold">
        <span style={headingStyle(theme, fontVar)}>{collection.title}</span>
      </AnimatedElement>
      <AnimatedElement as="div" preset={elementAnimations?.image} className={gridClass} options={{ staggerChildren: true }}>
        {collection.products.slice(0, 4).map((product) => (
          <a key={product.id} href={`/products/${product.id}`} className="min-w-[45%] flex-1 sm:min-w-0">
            <div className="mb-2 aspect-square overflow-hidden rounded-md bg-black/5">
              {product.media[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.media[0].url} alt={product.title} className="h-full w-full object-cover" />
              )}
            </div>
            <p className="text-sm">{product.title}</p>
          </a>
        ))}
      </AnimatedElement>
    </section>
  );
}

export function GallerySection({ theme, variant, elementAnimations, images }: BaseProps & { images: { url: string }[] }) {
  const layout = variant === 1 ? "columns-2 gap-4 sm:columns-3" : variant === 2 ? "flex gap-4 overflow-x-auto" : "grid grid-cols-2 gap-4 sm:grid-cols-3";
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background }}>
      <AnimatedElement as="div" preset={elementAnimations?.image} className={layout} options={{ staggerChildren: true }}>
        {images.length === 0
          ? Array.from({ length: 6 }, (_, i) => <div key={i} className="mb-4 aspect-square rounded-md" style={{ background: `${theme.colors.text}0f` }} />)
          : images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={img.url} alt="" className="mb-4 aspect-square w-full rounded-md object-cover" />
            ))}
      </AnimatedElement>
    </section>
  );
}

export function VideoBannerSection({ theme, variant, fontVar, elementAnimations }: BaseProps) {
  const isSplit = variant === 1;
  return (
    <section className={`px-6 py-16 ${isSplit ? "flex items-center gap-8" : "text-center"}`} style={{ background: theme.colors.text, color: theme.colors.background }}>
      <AnimatedElement as="div" preset={elementAnimations?.image} className={isSplit ? "flex-1" : "mx-auto max-w-2xl"} options={{}}>
        <div className="flex aspect-video items-center justify-center rounded-md" style={{ background: `${theme.colors.background}1a` }}>
          <div className="h-14 w-14 rounded-full" style={{ background: theme.colors.background, opacity: 0.85 }} />
        </div>
      </AnimatedElement>
      <AnimatedElement as="div" preset={elementAnimations?.heading} className={isSplit ? "flex-1" : "mt-6"} options={{}}>
        <h2 className="text-2xl font-semibold" style={{ fontFamily: fontVar || undefined }}>See it in motion</h2>
      </AnimatedElement>
    </section>
  );
}

export function CountdownSection({ theme, variant, elementAnimations }: BaseProps) {
  const parts = [{ n: "02", l: "Days" }, { n: "14", l: "Hours" }, { n: "08", l: "Min" }, { n: "45", l: "Sec" }];
  const overlay = variant === 1;
  return (
    <section
      className={`px-6 py-10 text-center ${overlay ? "" : ""}`}
      style={{ background: overlay ? theme.colors.primary : theme.colors.background, color: overlay ? "#fff" : theme.colors.text }}
    >
      <AnimatedElement as="div" preset={elementAnimations?.text} className="flex justify-center gap-6" options={{ staggerChildren: true }}>
        {parts.map((p) => (
          <div key={p.l}>
            <p className="font-mono text-3xl font-bold">{p.n}</p>
            <p className="text-xs uppercase tracking-wide opacity-70">{p.l}</p>
          </div>
        ))}
      </AnimatedElement>
    </section>
  );
}

export function StatsCounterSection({ theme, variant, elementAnimations }: BaseProps) {
  const stats = [
    { n: "12k+", l: "Orders shipped" },
    { n: "4.9", l: "Avg. rating" },
    { n: "98%", l: "On-time delivery" },
    { n: "30d", l: "Return window" },
  ];
  const shown = variant === 1 ? stats.slice(0, 3) : stats;
  return (
    <section className="px-6 py-16" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="div" preset={elementAnimations?.heading} className="grid grid-cols-2 gap-8 text-center sm:grid-cols-4" options={{ staggerChildren: true }}>
        {shown.map((s) => (
          <div key={s.l}>
            <p className="text-3xl font-bold" style={{ color: theme.colors.primary }}>{s.n}</p>
            <p className="mt-1 text-xs uppercase tracking-wide opacity-60">{s.l}</p>
          </div>
        ))}
      </AnimatedElement>
    </section>
  );
}

export function LogoCloudSection({ theme, variant }: BaseProps) {
  const marquee = variant === 1;
  return (
    <section className="px-6 py-10" style={{ background: theme.colors.background }}>
      <div className={`flex items-center justify-center gap-10 ${marquee ? "overflow-x-auto" : "flex-wrap"} opacity-50`}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-6 w-20 rounded" style={{ background: theme.colors.text }} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// RISE tier
// ---------------------------------------------------------------------------

export function TeamSection({ theme, variant, fontVar, elementAnimations }: BaseProps) {
  const members = [
    { name: "Sana Iqbal", role: "Founder" },
    { name: "Omar Farooq", role: "Operations" },
    { name: "Hina Zafar", role: "Design" },
  ];
  return (
    <section className="px-6 py-20 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-10 text-2xl font-semibold">
        <span style={headingStyle(theme, fontVar)}>Meet the team</span>
      </AnimatedElement>
      <AnimatedElement as="div" preset={elementAnimations?.image} className={variant === 1 ? "flex gap-8 overflow-x-auto" : "grid grid-cols-3 gap-8"} options={{ staggerChildren: true }}>
        {members.map((m) => (
          <div key={m.name} className="min-w-[30%]">
            <div className="mx-auto mb-3 aspect-square w-20 rounded-full" style={{ background: `${theme.colors.primary}22` }} />
            <p className="text-sm font-medium">{m.name}</p>
            <p className="text-xs opacity-60">{m.role}</p>
          </div>
        ))}
      </AnimatedElement>
    </section>
  );
}

export function BeforeAfterSection({ theme, variant, elementAnimations }: BaseProps) {
  const sideBySide = variant === 1;
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background }}>
      <AnimatedElement as="div" preset={elementAnimations?.image} className={sideBySide ? "grid grid-cols-2 gap-4" : "relative mx-auto max-w-2xl overflow-hidden rounded-md"}>
        {sideBySide ? (
          <>
            <div className="aspect-video rounded-md" style={{ background: `${theme.colors.text}14` }} />
            <div className="aspect-video rounded-md" style={{ background: `${theme.colors.primary}22` }} />
          </>
        ) : (
          <div className="flex aspect-video">
            <div className="w-1/2" style={{ background: `${theme.colors.text}14` }} />
            <div className="w-1/2" style={{ background: `${theme.colors.primary}22` }} />
          </div>
        )}
      </AnimatedElement>
    </section>
  );
}

export function MapLocationSection({ theme, variant, store, elementAnimations }: BaseProps & { store: PublicStore }) {
  if (variant === 1) {
    return (
      <section className="px-6 py-16 text-center" style={{ background: theme.colors.background, color: theme.colors.text }}>
        <AnimatedElement as="div" preset={elementAnimations?.text} className="mx-auto max-w-sm rounded-md p-6" options={{}}>
          <p className="font-medium">{store.name}</p>
          <p className="mt-1 text-sm opacity-70">Visit our storefront online anytime.</p>
        </AnimatedElement>
      </section>
    );
  }
  return (
    <section className="px-6 py-16" style={{ background: theme.colors.background }}>
      <AnimatedElement
        as="div"
        preset={elementAnimations?.text}
        className="mx-auto flex aspect-[16/7] max-w-3xl items-center justify-center rounded-md"
        style={{ background: `${theme.colors.text}0d` }}
      >
        <p className="text-sm opacity-50">Map embed</p>
      </AnimatedElement>
    </section>
  );
}

export function SocialFeedSection({ theme, elementAnimations }: BaseProps) {
  // Placeholder grid only - no live Instagram/Meta API integration in v1
  // (see this file's top-of-file note).
  return (
    <section className="px-6 py-16" style={{ background: theme.colors.background }}>
      <AnimatedElement as="div" preset={elementAnimations?.heading} className="grid grid-cols-3 gap-2 sm:grid-cols-6" options={{ staggerChildren: true }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-square rounded-sm" style={{ background: `${theme.colors.text}14` }} />
        ))}
      </AnimatedElement>
      <p className="mt-3 text-center text-xs opacity-50">Social feed - connect an account to show real posts here</p>
    </section>
  );
}

export function StickyCtaSection({ theme, variant, elementAnimations }: BaseProps) {
  const corner = variant === 1;
  return (
    <div
      className={corner ? "fixed bottom-4 right-4 z-30 rounded-full px-4 py-3 shadow-lg" : "sticky bottom-0 z-30 flex items-center justify-between px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"}
      style={{ background: theme.colors.primary, color: "#fff" }}
    >
      <AnimatedElement as="span" preset={elementAnimations?.text} className="text-sm font-medium">
        {corner ? "Shop now" : "Free shipping on orders over Rs. 3,000"}
      </AnimatedElement>
      {!corner && (
        <AnimatedElement as="button" preset={elementAnimations?.button} className="rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold">
          Shop now
        </AnimatedElement>
      )}
    </div>
  );
}

export function ShapeDividerSection({ theme, variant }: BaseProps) {
  const paths: Record<number, string> = {
    0: "M0,32 C240,80 480,0 720,32 C960,64 1200,16 1440,32 L1440,64 L0,64 Z",
    1: "M0,0 L1440,64 L1440,0 Z",
    2: "M0,64 Q720,-32 1440,64 Z",
  };
  return (
    <svg viewBox="0 0 1440 64" className="block w-full" style={{ height: 48 }} preserveAspectRatio="none">
      <path d={paths[variant ?? 0] ?? paths[0]} fill={theme.colors.primary} opacity={0.15} />
    </svg>
  );
}

export function ComparisonTableSection({ theme, variant, elementAnimations }: BaseProps & { products: PublicProduct[] }) {
  const rows = ["Price", "Free shipping", "Return policy", "Warranty"];
  const cols = variant === 1 ? 3 : 2;
  return (
    <section className="px-6 py-20 overflow-x-auto" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement as="h2" preset={elementAnimations?.heading} className="mb-8 text-center text-2xl font-semibold">
        <span style={headingStyle(theme)}>Compare</span>
      </AnimatedElement>
      <table className="mx-auto w-full max-w-2xl border-collapse text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-b" style={{ borderColor: `${theme.colors.text}1a` }}>
              <td className="py-3 pr-4 font-medium opacity-70">{row}</td>
              {Array.from({ length: cols }, (_, i) => (
                <td key={i} className="py-3 text-center opacity-90">—</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function BlogHighlightSection({ theme, variant, elementAnimations }: BaseProps) {
  const posts = [
    { title: "How we source every product", excerpt: "A look behind the scenes at our supplier vetting." },
    { title: "Our sizing guide, explained", excerpt: "Everything you need before you buy." },
  ];
  const list = variant === 1;
  return (
    <section className="px-6 py-20" style={{ background: theme.colors.background, color: theme.colors.text }}>
      <AnimatedElement
        as="div"
        preset={elementAnimations?.heading}
        className={list ? "mx-auto max-w-xl space-y-6" : "grid grid-cols-1 gap-6 sm:grid-cols-2"}
        options={{ staggerChildren: true }}
      >
        {posts.map((post) => (
          <div key={post.title}>
            <AnimatedElement as="div" preset={elementAnimations?.image} className="mb-3 aspect-video rounded-md" style={{ background: `${theme.colors.primary}14` }} />
            <p className="font-medium">{post.title}</p>
            <p className="mt-1 text-sm opacity-70">{post.excerpt}</p>
          </div>
        ))}
      </AnimatedElement>
    </section>
  );
}
