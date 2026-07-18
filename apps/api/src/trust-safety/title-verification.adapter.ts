/**
 * SRS §5.30/FR-30.4 - the future-swap seam for automated bank-account-name
 * verification (Raast/1Link or equivalent), built the same way this SRS
 * already handles every other future-swap point (Payment Gateway Adapter
 * §5.6d, Supplier Adapter §5.3): one interface, exactly one v1.0
 * implementation. Swapping in a real API-backed adapter later requires only
 * a new class implementing this interface - never a change to
 * PaymentInstrumentIdentityService's review-queue logic (§14.30 checklist).
 */
export interface TitleVerificationResult {
  outcome: "verified" | "unverified_pending_review";
}

export interface TitleVerificationAdapter {
  verify(declaredTitle: string, sellerLegalName: string): Promise<TitleVerificationResult>;
}

/**
 * v1.0's only implementation - always defers to a human reviewer and does
 * nothing else (no network call, no heuristic of its own; the string-
 * similarity pre-check that decides whether a title needs review at all
 * lives in PaymentInstrumentIdentityService, not here).
 */
export class ManualReviewAdapter implements TitleVerificationAdapter {
  async verify(): Promise<TitleVerificationResult> {
    return { outcome: "unverified_pending_review" };
  }
}
