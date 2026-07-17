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
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
