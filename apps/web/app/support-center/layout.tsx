import Link from "next/link";
import { ReactNode } from "react";

/**
 * SRS FR-8.20 (Module 99, founder batch B17) - the shared shell for every
 * support.uzeyn.com page. Deliberately its own minimal header, not the
 * dashboard's Sidebar - this subdomain is a separate destination for a
 * seller, not a dashboard tab (the founder's own framing), and a seller
 * here has already authenticated separately (a different origin from
 * app.uzeyn.com - see FR-8.20's authentication note).
 */
export default function SupportCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface px-6 py-4">
        <Link href="/" className="font-display text-h5 font-bold tracking-tight text-ink">
          UZEYN Support Center
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
