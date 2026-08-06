import { Instrument_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Founder-mandated comparison (Phase 1 redo): present Geist alongside exactly
 * ONE alternative before committing. Instrument Sans, tightened, is the
 * candidate — a grotesque with a bit more warmth than Geist at display size.
 * Geist wins on the actual page (layout.tsx / globals.css --font-display)
 * because it holds its axis at both extremes: legible in Inter-adjacent body
 * contexts and cold/confident at 100+px, matching vercel.com/stripe's own
 * choice. Instrument Sans reads slightly softer / rounder at the same tracking
 * — closer to "friendly startup" than the ink-on-paper direction this system
 * committed to. This page is the record of that decision, not a live toggle.
 */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const SAMPLE_HEADLINE = "Sell more, worry less.";
const SAMPLE_SUB = "Everything your store needs, built for the way you sell.";

function TypeSample({
  label,
  fontClassName,
  fontVar,
  verdict,
}: {
  label: string;
  fontClassName: string;
  fontVar: string;
  verdict: { tone: "chosen" | "rejected"; text: string };
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-eyebrow uppercase text-ink-faint">{label}</p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            verdict.tone === "chosen" ? "bg-accent-subtle text-accent" : "bg-canvas text-ink-faint"
          }`}
        >
          {verdict.tone === "chosen" ? "Chosen" : "Rejected"}
        </span>
      </div>

      <div className={`${fontClassName} rounded-2xl border border-border bg-surface p-10`}>
        <p
          className="text-ink"
          style={{
            fontFamily: `var(${fontVar})`,
            fontSize: "clamp(2.5rem, 2rem + 4vw, 4.5rem)",
            lineHeight: 0.98,
            letterSpacing: "-0.04em",
            fontWeight: 700,
          }}
        >
          {SAMPLE_HEADLINE}
        </p>
        <p
          className="mt-6 text-ink-muted"
          style={{ fontFamily: `var(${fontVar})`, fontSize: "1.1875rem", lineHeight: 1.5, fontWeight: 400 }}
        >
          {SAMPLE_SUB}
        </p>
        <p
          className="mt-8 text-ink"
          style={{ fontFamily: `var(${fontVar})`, fontSize: "1.5rem", letterSpacing: "-0.02em", fontWeight: 700 }}
        >
          Section heading at h3 scale
        </p>
        <p
          className="mt-3 text-ink-muted"
          style={{ fontFamily: `var(${fontVar})`, fontSize: "0.875rem", fontWeight: 400 }}
        >
          Dense UI text at 14px — order #10482, sara.khan@example.com, Rs 4,250.
        </p>
      </div>

      <p className="mt-4 max-w-sm text-sm text-ink-muted">{verdict.text}</p>
    </div>
  );
}

export default function TypeComparisonPage() {
  return (
    <div className={`min-h-screen bg-canvas ${instrumentSans.variable}`}>
      <div className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          <a href="/design-system" className="font-display text-sm font-bold tracking-tight text-ink">
            UZEYN / design system
          </a>
          <span className="text-ink-faint">/</span>
          <span className="text-sm font-medium text-ink-muted">Type comparison</span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-32">
        <Reveal>
          <p className="text-eyebrow uppercase text-accent">Phase 1 · Module 19 · v1.1 redo</p>
          <h1 className="mt-4 font-display text-h1 text-ink">Display face: Geist vs. Instrument Sans.</h1>
          <p className="mt-6 max-w-2xl text-body-lg text-ink-muted">
            Plus Jakarta Sans was rejected as reading &ldquo;friendly startup,&rdquo; not &ldquo;premium
            minimal.&rdquo; Geist and Instrument Sans are shown here at identical scale, tracking, and
            weight so the difference is only the typeface itself. Inter remains the body/UI face in both
            cases — this comparison is about the display voice only.
          </p>
        </Reveal>

        <Reveal stagger={0.08} className="mt-20 grid gap-16 lg:grid-cols-2">
          <TypeSample
            label="Geist"
            fontClassName={GeistSans.variable}
            fontVar="--font-geist-sans"
            verdict={{
              tone: "chosen",
              text: "Cold, confident, Swiss-grotesque bones. Holds its shape at both 14px dense-table scale and 96px hero scale with no personality tax. Matches the apple/linear/vercel/stripe reference set.",
            }}
          />
          <TypeSample
            label="Instrument Sans (tightened)"
            fontClassName={instrumentSans.variable}
            fontVar="--font-instrument-sans"
            verdict={{
              tone: "rejected",
              text: "Rounder terminals and a warmer default rhythm — reads closer to a friendly consumer-app voice than ink-on-paper premium, even at matched tracking. Legible, but not the right register.",
            }}
          />
        </Reveal>

        <Reveal className="mt-24 border-t border-border pt-12">
          <h2 className="font-display text-h3 text-ink">Decision</h2>
          <p className="mt-3 max-w-2xl text-body text-ink-muted">
            Geist ships as <code className="font-mono text-sm text-ink">--font-display</code> across the
            product (see <code className="font-mono text-sm text-ink">app/layout.tsx</code> and{" "}
            <code className="font-mono text-sm text-ink">app/globals.css</code>). Instrument Sans is not
            installed as a runtime dependency of any other page — it is loaded only on this comparison
            page for the side-by-side.
          </p>
        </Reveal>
      </main>
    </div>
  );
}
