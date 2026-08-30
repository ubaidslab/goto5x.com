import { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Founder batch A1 - shared centered shell for every pre-auth screen
 * (seller /login, /admin/login). Not a Next layout.tsx because the two
 * pages live in different route groups ((auth) vs (admin)/admin) with no
 * common ancestor route - a plain component avoids duplicating this
 * markup in each page file instead.
 */
export function AuthShell({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Reveal className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-h4 font-bold tracking-tight text-ink">UZEYN</span>
          {eyebrow && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{eyebrow}</p>
          )}
        </div>
        {children}
      </Reveal>
    </main>
  );
}
