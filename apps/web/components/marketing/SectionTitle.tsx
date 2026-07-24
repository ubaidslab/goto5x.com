import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

/**
 * The center-aligned, rise-up-and-fade section title pattern the founder
 * specified for Phase 2's scroll storytelling spine - every major
 * homepage section opens with one of these before its own content.
 */
export function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-eyebrow uppercase text-accent">{eyebrow}</p>
      <h2 className="mt-4 font-display text-h1 text-ink">{title}</h2>
      {description && <p className="mt-5 text-body-lg text-ink-muted">{description}</p>}
    </Reveal>
  );
}
