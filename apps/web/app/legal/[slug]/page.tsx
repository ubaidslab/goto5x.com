import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Reveal } from "@/components/motion/Reveal";
import { renderLegalMarkdown } from "@/lib/legal-markdown";

// Aliases match MarketingFooter's existing links (/legal/terms, /legal/privacy,
// /legal/refund-policy); the other two docs keep their filename as the slug
// since nothing links to them from the marketing site yet.
const SLUG_TO_FILE: Record<string, string> = {
  terms: "terms-of-service.md",
  privacy: "privacy-policy.md",
  "refund-policy": "refund-policy.md",
  "growth-partner-programs-terms": "growth-partner-programs-terms.md",
  "verified-store-program-terms": "verified-store-program-terms.md",
};

/**
 * Renders the real drafts in docs/legal/ - not a CMS-backed page (see
 * ContentPage, FR-12.1) because these are still unreviewed legal drafts,
 * not admin-editable copy yet; wiring them into the live content-page
 * system is future work once counsel signs off, not a Phase 2 concern.
 */
export default function LegalPage({ params }: { params: { slug: string } }) {
  const filename = SLUG_TO_FILE[params.slug];
  if (!filename) notFound();

  const filePath = path.join(process.cwd(), "..", "..", "docs", "legal", filename);
  let source: string | null = null;
  try {
    source = fs.readFileSync(filePath, "utf-8");
  } catch {
    // fall through to notFound() below
  }
  if (source === null) notFound();

  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />

      <article className="pb-32 pt-40 sm:pt-48">
        <div className="mx-auto max-w-2xl px-6">
          <Reveal>{renderLegalMarkdown(source)}</Reveal>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
