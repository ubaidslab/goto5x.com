import { Lock } from "lucide-react";
import { ReactNode } from "react";

/**
 * Phase 4 close-out - the first shared primitive for a tier-gated feature's
 * locked state, mirroring EmptyState's own "explain what this is and what
 * to do next" shape (same layout/tone) rather than each gated feature
 * inventing its own copy. Establishes the pattern this project's other
 * gated features (Customer Segments, Gift Cards, premium themes, etc.)
 * should converge on in a later pass - not retrofitted everywhere in this
 * change, just introduced here at its first real use.
 */
export function UpgradeLockedCard({
  requiredTier,
  title,
  description,
  action,
}: {
  /** e.g. "RISE" - paired with its subtitle via plan-tier-copy.ts by the caller if useful. */
  requiredTier: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-faint" aria-hidden>
        <Lock className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-h4 font-display text-ink">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Available on {requiredTier} and above</p>
      </div>
      {action}
    </div>
  );
}
