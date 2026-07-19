import { createHmac, timingSafeEqual } from "crypto";

/**
 * SRS §6.5 - the HMAC signature scheme both external-SaaS hooks that are
 * called client-to-client (never on behalf of an already-authenticated
 * seller) verify before granting an entitlement or answering an eligibility
 * check: the Template Install/License API (FR-24.6) and the cross-SaaS
 * discount-eligibility endpoint (FR-24.14). The Product Feed API (FR-24.9/
 * FR-24.10) uses a different mechanism - a seller-scoped bearer token - since
 * that call is made on behalf of one specific, already-onboarded seller; see
 * product-feed.service.ts's own doc comment for why a second signature layer
 * there would be redundant, not additive, security.
 *
 * Signed payload is always `${timestamp}.${payload}` where `payload` is the
 * raw request body text for a POST/PUT call, or a canonical query string for
 * a GET call - whichever the calling controller actually needs authenticated,
 * never a re-serialized/parsed representation (re-serializing JSON can
 * silently change byte content and break a real signature that a re-parsed
 * body would incorrectly still "verify").
 */
const REPLAY_TOLERANCE_MS = 5 * 60 * 1000;

export function computeSignature(secret: string, timestamp: string, payload: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

/** Timing-safe comparison - a naive `===` would leak timing information about how many leading bytes matched. */
export function verifySignature(secret: string, timestamp: string, payload: string, providedSignatureHex: string): boolean {
  const expectedHex = computeSignature(secret, timestamp, payload);
  const expected = Buffer.from(expectedHex, "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(providedSignatureHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/** Rejects a stale or clock-skewed timestamp - the anti-replay half of the scheme (a captured, valid signature can't be resent indefinitely). */
export function isTimestampFresh(timestamp: string, nowMs: number = Date.now()): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowMs - ts) <= REPLAY_TOLERANCE_MS;
}
