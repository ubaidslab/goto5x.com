"use client";

import { PartyPopper, X } from "lucide-react";
import { useEffect, useState } from "react";

export interface Milestone {
  id: string;
  metric: "order_count" | "sales_amount";
  threshold: number;
}

function copyFor(milestone: Milestone): string {
  if (milestone.metric === "order_count") {
    if (milestone.threshold === 1) return "You got your first order!";
    return `You've crossed ${milestone.threshold.toLocaleString()} confirmed orders.`;
  }
  return `You've crossed Rs ${milestone.threshold.toLocaleString()} in total sales.`;
}

function dismissKey(id: string): string {
  return `uzeyn-milestone-dismissed-${id}`;
}

/**
 * SRS §5.47/FR-47.2 - the milestone-celebration banner. Dismissal is
 * per-browser (localStorage), not persisted server-side - MilestoneEvent
 * is deliberately append-only (FR-47.3), so "seen" state lives here
 * instead of mutating that table. The backend's own 3-day recency window
 * (MilestonesService.getRecent) keeps an old milestone from resurrecting
 * itself indefinitely if that localStorage entry is ever cleared.
 */
export function MilestoneBanner({ milestone }: { milestone: Milestone | null }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!milestone) {
      setDismissed(true);
      return;
    }
    try {
      setDismissed(window.localStorage.getItem(dismissKey(milestone.id)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [milestone]);

  if (!milestone || dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(dismissKey(milestone!.id), "1");
    } catch {
      // Private browsing / storage disabled - dismiss for this page view only.
    }
    setDismissed(true);
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-[14px] bg-accent-subtle px-5 py-4">
      <div className="flex items-center gap-3">
        <PartyPopper className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
        <p className="text-sm font-medium text-ink">{copyFor(milestone)}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
