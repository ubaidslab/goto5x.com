import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PricingCard({
  name,
  priceLabel,
  cadence,
  description,
  features,
  featured,
  ctaLabel = "Start free",
  ctaHref = "/signup",
}: {
  name: string;
  priceLabel: string;
  cadence?: string;
  description: string;
  features: string[];
  featured?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-8 transition-smooth",
        featured
          ? "border-ink bg-ink text-canvas shadow-lg"
          : "border-border bg-surface shadow-xs hover:border-border-strong hover:shadow-sm",
      )}
    >
      {featured && (
        <span className="mb-4 inline-flex w-fit items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">
          Most popular
        </span>
      )}
      <h3 className={cn("font-display text-h3 font-bold", featured ? "text-canvas" : "text-ink")}>{name}</h3>
      <p className={cn("mt-2 text-sm", featured ? "text-canvas/70" : "text-ink-muted")}>{description}</p>
      <div className="mt-6 flex items-baseline gap-1">
        <span className={cn("font-display text-h1 font-bold", featured ? "text-canvas" : "text-ink")}>{priceLabel}</span>
        {cadence && <span className={cn("text-sm", featured ? "text-canvas/70" : "text-ink-faint")}>/{cadence}</span>}
      </div>
      <Link
        href={ctaHref}
        className={cn(
          "mt-8 inline-flex h-11 items-center justify-center rounded-md text-sm font-medium transition-smooth-fast active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          featured
            ? "bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-canvas focus-visible:ring-offset-ink"
            : "border border-border-strong bg-transparent text-ink hover:bg-canvas focus-visible:ring-accent focus-visible:ring-offset-canvas",
        )}
      >
        {ctaLabel}
      </Link>
      <ul className="mt-8 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", featured ? "text-accent" : "text-accent")} strokeWidth={2} aria-hidden />
            <span className={featured ? "text-canvas/90" : "text-ink-muted"}>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
