import * as Sentry from "@sentry/node";

/**
 * D116 item 6 (Stage 0 ops minimum) - "error tracking/alerting." Optional:
 * a missing SENTRY_DSN just means this never initializes, same
 * "skipped_not_configured, not a crash" discipline as the backup sweep
 * (backups/database-backup.service.ts). Called from both main.ts (API
 * process) and worker/worker.main.ts (BullMQ process) - two separate
 * Node processes, each needs its own init.
 *
 * This codebase has a standing "never send request bodies/headers/
 * cookies anywhere outside this process" discipline (see
 * pii-redaction.interceptor.ts), and http-exception.filter.ts only ever
 * calls Sentry.captureException(exception) with the bare error, never a
 * request object. `beforeSend` is a second, explicit, version-independent
 * backstop against the SDK's own default HTTP auto-instrumentation ever
 * attaching ambient request/header/cookie data to an event on its own -
 * checked directly against this SDK version's actual NodeOptions type
 * rather than assuming a `sendDefaultPii`-style flag exists (it doesn't,
 * in the installed major version).
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    beforeSend(event) {
      delete event.request;
      return event;
    },
  });
}
