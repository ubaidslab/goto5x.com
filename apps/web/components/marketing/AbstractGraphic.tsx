/**
 * Code-generated abstract graphics for sections that need visual rhythm
 * without a screenshot - gradient mesh blobs and a dot-grid, both built
 * from our own tokens (ink/accent at low opacity), never a stock asset.
 */
export function GradientMesh({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 800"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="mesh-a" cx="30%" cy="20%" r="60%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-b" cx="75%" cy="65%" r="55%">
          <stop offset="0%" stopColor="var(--color-ink)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="800" fill="url(#mesh-a)" />
      <rect width="800" height="800" fill="url(#mesh-b)" />
    </svg>
  );
}

export function DotGrid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill="var(--color-border-strong)" />
        </pattern>
        <linearGradient id="dot-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="dot-mask">
          <rect width="400" height="400" fill="url(#dot-fade)" />
        </mask>
      </defs>
      <rect width="400" height="400" fill="url(#dot-grid)" mask="url(#dot-mask)" />
    </svg>
  );
}
