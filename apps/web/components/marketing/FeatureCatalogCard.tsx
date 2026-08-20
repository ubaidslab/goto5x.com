import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

/**
 * Module 80 (SRS §5.6j, FR-7.24) - the pricing page's "every existing
 * feature, grouped into readable sections" catalog. Same icon-in-box
 * language as FeatureCard (bg-accent-subtle/text-accent), but a taller
 * card built to hold a scannable feature list rather than one description
 * line - these two components deliberately look related, not identical,
 * since they serve different reading modes (skim vs. verify).
 */
export function FeatureCatalogCard({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle text-accent">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="mt-6 font-display text-h3 font-bold text-ink">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-body text-ink-muted">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
