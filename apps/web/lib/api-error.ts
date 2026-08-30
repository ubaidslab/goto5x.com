/**
 * The API's global exception filter (apps/api/src/common/filters/
 * http-exception.filter.ts) wraps every error body as
 * `{ statusCode, message: exception.getResponse() }` - and Nest's own
 * built-in exceptions (UnauthorizedException, BadRequestException,
 * ConflictException, the rate limiter's HttpException, ValidationPipe
 * failures, etc. - the overwhelming majority of how this backend throws
 * errors) already return an OBJECT from getResponse() (`{ statusCode,
 * message, error }`), not a plain string. So `body.message` here is itself
 * an object one level deeper, not the human-readable string.
 *
 * Originally written for the two login pages (founder batch A1), where
 * rendering the un-unwrapped object directly as a JSX child crashed the
 * page outright. Found again, independently, while building founder batch
 * A6 (design-token locking): lib/dashboard-api.ts and lib/admin-api.ts -
 * the shared fetch wrappers roughly 60 dashboard/admin pages call through -
 * had the exact same shape-mismatch, just with a softer failure mode (falls
 * back to `res.statusText`, e.g. "Conflict", instead of crashing). Every
 * built-in-exception error message shown anywhere in the dashboard or
 * admin terminal has likely been silently replaced with generic HTTP
 * status text instead of the backend's actual message, for as long as
 * those two files have existed - this helper is now the one shared fix for
 * all three call sites rather than three separate inline unwraps.
 */
export function getApiErrorMessage(body: unknown, fallback: string): string {
  const outer = (body as { message?: unknown } | null)?.message;
  const inner = outer && typeof outer === "object" ? (outer as { message?: unknown }).message : outer;
  if (typeof inner === "string") return inner;
  if (Array.isArray(inner)) return inner.join(", ");
  return fallback;
}
