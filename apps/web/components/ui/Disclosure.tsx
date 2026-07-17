"use client";

import { ReactNode, useState } from "react";

/**
 * Progressive disclosure (SIMPLICITY INVARIANT rule (b)): advanced options
 * live behind a clearly-labeled expander, never cluttering the default
 * view. One shared implementation so "Advanced" always looks and behaves
 * the same way, screen to screen.
 */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-medium text-ink-muted transition-smooth-fast hover:text-ink"
        aria-expanded={open}
      >
        {label}
        <svg
          className={`h-4 w-4 transition-smooth ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}
