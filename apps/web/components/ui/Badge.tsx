import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-canvas text-ink-muted",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
} as const;

const dotTones = {
  neutral: "bg-ink-faint",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
} as const;

/** Status pill - semantic tone carries meaning independent of the accent color, per this system's "color + form, never color alone" rule. `dot` adds a status indicator for scan-at-a-glance tables. */
export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: keyof typeof tones;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotTones[tone])} aria-hidden />}
      {children}
    </span>
  );
}
