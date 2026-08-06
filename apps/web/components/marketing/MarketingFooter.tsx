import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/design-system", label: "Design system" },
      { href: "/signup", label: "Start selling" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/careers", label: "Careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/refund-policy", label: "Refund policy" },
    ],
  },
];

/** Shared across every marketing/legal/careers/about surface - one footer, never a per-page one-off. */
export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-display text-h4 font-bold tracking-tight text-ink">UZEYN</span>
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              The all-in-one commerce platform for Pakistan&apos;s sellers.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-ink">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-ink-muted transition-smooth-fast hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-ink-faint sm:flex-row">
          <p>&copy; {new Date().getFullYear()} UZEYN. All rights reserved.</p>
          <p>Made for Pakistan&apos;s sellers.</p>
        </div>
      </div>
    </footer>
  );
}
