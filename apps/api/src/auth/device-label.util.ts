/**
 * SRS §5.25/FR-25.7 - a friendly, best-effort device label for the seller's
 * session list ("Chrome on Windows"), derived from the request's own
 * User-Agent header - never client-supplied, since a client-chosen label
 * isn't authoritative. Deliberately a small regex-based parser, not a new
 * dependency: the SIMPLICITY INVARIANT (§3.13) calls for "good enough for a
 * seller to recognize their own device," not a comprehensive UA database.
 */
export function labelDevice(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)
          ? "Safari"
          : "Unknown browser";

  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${os}`;
}
