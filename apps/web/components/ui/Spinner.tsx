export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-border-strong border-t-accent ${className}`}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
