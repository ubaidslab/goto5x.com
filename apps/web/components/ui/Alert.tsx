import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  danger: { classes: "bg-danger-subtle text-danger", Icon: XCircle },
  success: { classes: "bg-success-subtle text-success", Icon: CheckCircle2 },
  info: { classes: "bg-info-subtle text-info", Icon: Info },
  warning: { classes: "bg-warning-subtle text-warning", Icon: AlertTriangle },
} as const;

/** Inline form/page status messages - one shared shape (SIMPLICITY INVARIANT §3.13(a): plain language, no jargon). */
export function Alert({
  tone = "danger",
  className,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: React.ReactNode;
}) {
  const { classes, Icon } = tones[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-md px-4 py-3 text-sm", classes, className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
