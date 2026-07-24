"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Marketing-scale FAQ accordion - same expand/collapse mechanics as
 * components/ui/Disclosure, but sized for a landing-page FAQ section
 * (larger question text, one-at-a-time behavior). All 8 component-polish
 * states: default, hover, focus-visible ring, active (scale), no
 * disabled/loading/error (a static FAQ toggle has none), empty n/a.
 */
export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-smooth-fast hover:bg-canvas active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <span className="font-display text-h4 font-bold text-ink">{item.question}</span>
              <ChevronDown
                className={cn("h-5 w-5 shrink-0 text-ink-faint transition-smooth", open && "rotate-180 text-accent")}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            {open && (
              <div className="animate-[fade-in_var(--duration-base)_var(--ease-standard)] px-6 pb-6">
                <p className="max-w-2xl text-body text-ink-muted">{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
