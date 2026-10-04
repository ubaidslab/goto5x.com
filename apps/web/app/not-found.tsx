import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Security-checklist audit finding: no custom error/not-found page existed
 * anywhere in apps/web - every 404 fell through to Next's own generic,
 * unbranded default. Root-level, so it covers every route group (storefront,
 * dashboard, admin, marketing) that doesn't define its own.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">404</p>
      <h1 className="text-h2 text-ink">Page not found</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link href="/">
        <Button variant="secondary" size="sm">
          Go home
        </Button>
      </Link>
    </div>
  );
}
