import Image from "next/image";

/**
 * Code-generated browser-chrome frame (traffic-light dots + a fake address
 * bar) around a real screenshot of our own product - per the founder's
 * "we HAVE a real product, show it" instruction. The image is the actual
 * content; only the chrome around it is decorative.
 */
export function DeviceMockup({
  src,
  alt,
  url,
  width = 1200,
  height = 750,
}: {
  src: string;
  alt: string;
  url: string;
  width?: number;
  height?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
      <div className="flex items-center gap-2 border-b border-border bg-canvas px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <div className="ml-3 flex-1 truncate rounded-full border border-border bg-surface px-3 py-1 text-center font-mono text-xs text-ink-faint">
          {url}
        </div>
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-auto w-full"
        sizes="(min-width: 1024px) 800px, 100vw"
      />
    </div>
  );
}
