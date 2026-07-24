import { ReactNode } from "react";

/**
 * SIMPLICITY INVARIANT rule (e): every empty state explains what the
 * screen is for and offers the next action - never just a blank list.
 * One shared shape so every screen's "nothing here yet" looks the same.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-faint" aria-hidden>
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-h4 font-display text-ink">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
