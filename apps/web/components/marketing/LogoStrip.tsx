/**
 * Placeholder social-proof logos (SRS: real merchant logos are future
 * work, pending sign-off to name them publicly). Rendered as restrained
 * wordmarks, not fake company icons - reads as a placeholder, not a lie.
 */
const PLACEHOLDER_NAMES = ["Northline", "Auravest", "Kohsar & Co.", "Meridian Goods", "Palazzo Home"];

export function LogoStrip() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
      {PLACEHOLDER_NAMES.map((name) => (
        <span
          key={name}
          className="font-display text-h4 font-bold tracking-tight text-ink-faint grayscale transition-smooth-fast hover:text-ink-muted"
        >
          {name}
        </span>
      ))}
    </div>
  );
}
