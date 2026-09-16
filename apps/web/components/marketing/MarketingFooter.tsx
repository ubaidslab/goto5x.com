"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon } from "@/components/marketing/SocialIcons";

interface BrandAsset {
  kind: string;
  url: string;
}

// Founder walkthrough finding (Phase 1 item 10) - admin-editable via the
// content-pages page's "Social links" card (same brand-assets mechanism,
// SRS FR-12.3), not hardcoded. A network with no URL set for its kind is
// simply omitted below rather than shown as a dead/placeholder link.
const SOCIAL_LINKS: { kind: string; label: string; Icon: typeof LinkedInIcon }[] = [
  { kind: "social_linkedin", label: "LinkedIn", Icon: LinkedInIcon },
  { kind: "social_facebook", label: "Facebook", Icon: FacebookIcon },
  { kind: "social_instagram", label: "Instagram", Icon: InstagramIcon },
  { kind: "social_tiktok", label: "TikTok", Icon: TikTokIcon },
];

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
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [socialUrls, setSocialUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${apiBase}/brand-assets`)
      .then((r) => (r.ok ? r.json() : []))
      .then((assets: BrandAsset[]) => {
        setSocialUrls(Object.fromEntries(assets.filter((a) => a.kind.startsWith("social_") && a.url).map((a) => [a.kind, a.url])));
      })
      .catch(() => setSocialUrls({}));
  }, [apiBase]);

  const activeSocialLinks = SOCIAL_LINKS.filter((s) => socialUrls[s.kind]);

  return (
    <footer className="border-t border-border bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-display text-h4 font-bold tracking-tight text-ink">UZEYN</span>
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              The all-in-one commerce platform for Pakistan&apos;s sellers.
            </p>
            {activeSocialLinks.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                {activeSocialLinks.map(({ kind, label, Icon }) => (
                  <a
                    key={kind}
                    href={socialUrls[kind]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-ink-faint transition-smooth-fast hover:text-ink"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            )}
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
