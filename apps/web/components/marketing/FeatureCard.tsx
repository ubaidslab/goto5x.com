import type { LucideIcon } from "lucide-react";

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-80 w-[320px] shrink-0 snap-start flex-col justify-between rounded-2xl border border-border bg-surface p-8 shadow-sm sm:w-[380px]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle text-accent">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <div>
        <h3 className="font-display text-h3 font-bold text-ink">{title}</h3>
        <p className="mt-3 text-body text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
