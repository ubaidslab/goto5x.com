"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Security-checklist audit finding: no custom error page existed anywhere in
 * apps/web - a rendering error fell through to Next's own generic,
 * unbranded default. Root-level, so it covers every route group. Next.js
 * requires this to be a Client Component (it receives the thrown error and
 * a reset callback) - deliberately never renders `error.message`/`error.stack`
 * to the page, same "no raw internals to the client" discipline the API's
 * own global exception filter already follows.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Unhandled page error - caught by app/error.tsx");
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">Error</p>
      <h1 className="text-h2 text-ink">Something went wrong</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        An unexpected error occurred. You can try again, or go back to the homepage.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" size="sm" onClick={() => reset()}>
          Try again
        </Button>
        <Button
          size="sm"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          Go home
        </Button>
      </div>
    </div>
  );
}
