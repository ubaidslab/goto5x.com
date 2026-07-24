export function TestimonialCard({
  quote,
  name,
  role,
}: {
  quote: string;
  name: string;
  role: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-8 shadow-xs">
      <p className="font-display text-h4 font-bold leading-snug text-ink">&ldquo;{quote}&rdquo;</p>
      <div className="mt-6 flex items-center gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-ink-muted"
        >
          {name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="text-xs text-ink-faint">{role}</p>
        </div>
      </div>
    </div>
  );
}
