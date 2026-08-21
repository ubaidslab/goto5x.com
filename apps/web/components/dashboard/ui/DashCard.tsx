import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * UI/UX Design Phase card - the dashboard/admin-only "no visible borders,
 * tonal background" treatment (Part A item 2 of the founder's mandate).
 * Deliberately a separate component from components/ui/Card.tsx rather
 * than a fork/variant of it: that component's CardHeader/CardFooter
 * hardcode border-b/border-t with no className escape hatch, and it's
 * shared by 20+ marketing/storefront files this mandate explicitly must
 * not touch. Surfaces differentiate from the page via the scoped
 * --color-surface token (#fafafa, set in globals.css's .app-shell-surface
 * block) against --color-canvas (#fff) - never a border.
 */
export function DashCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[14px] bg-surface p-6 shadow-xs", className)} {...props}>
      {children}
    </div>
  );
}

export function DashCardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function DashCardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mt-5 flex items-center justify-end gap-2", className)}>{children}</div>;
}
