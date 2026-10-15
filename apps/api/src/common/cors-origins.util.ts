/**
 * D82 - shared by main.ts's app.enableCors() and RefreshCookieCsrfGuard, so
 * the two never drift apart from each other. Empty in production (same-
 * origin behind Traefik, see main.ts's own comment) - non-empty only for
 * local dev (web/API on different ports) and any future cross-origin
 * client (e.g. a mobile app).
 */
export function getAllowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
