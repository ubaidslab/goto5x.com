const tones = {
  danger: "bg-danger-subtle text-danger",
  success: "bg-success-subtle text-success",
  info: "bg-info-subtle text-info",
  warning: "bg-warning-subtle text-warning",
} as const;

/** Inline form/page status messages - one shared shape (SIMPLICITY INVARIANT §3.13(a): plain language, no jargon). */
export function Alert({ tone = "danger", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <div className={`rounded-md px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
