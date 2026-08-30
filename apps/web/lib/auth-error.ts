/**
 * The API's global exception filter (apps/api/src/common/filters/
 * http-exception.filter.ts) wraps every error body as
 * `{ statusCode, message: exception.getResponse() }` - and Nest's own
 * built-in exceptions (UnauthorizedException, the rate limiter's
 * HttpException, ValidationPipe failures, etc.) already return an OBJECT
 * from getResponse() (`{ statusCode, message, error }`), not a plain
 * string. So `body.message` here is itself an object one level deeper,
 * not the human-readable string - rendering it directly as a React child
 * throws ("Objects are not valid as a React child"). Unwrap one more
 * level before it ever reaches JSX.
 */
export function getAuthErrorMessage(body: unknown, fallback: string): string {
  const outer = (body as { message?: unknown } | null)?.message;
  const inner = outer && typeof outer === "object" ? (outer as { message?: unknown }).message : outer;
  if (typeof inner === "string") return inner;
  if (Array.isArray(inner)) return inner.join(", ");
  return fallback;
}
