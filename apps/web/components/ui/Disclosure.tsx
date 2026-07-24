"use client";

import { ChevronDown } from "lucide-react";
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
        className="flex w-full items-center justify-between rounded-sm text-sm font-medium text-ink-muted transition-smooth-fast hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-smooth ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>
      {open && <div className="mt-4 space-y-4 animate-[fade-in_var(--duration-base)_var(--ease-standard)]">{children}</div>}
    </div>
  );
}
