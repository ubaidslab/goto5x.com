import { SetMetadata } from "@nestjs/common";

export const SKIP_AGREEMENT_CHECK_KEY = "skipAgreementCheck";

/**
 * Module 12 (SRS §5.29/FR-29.1). SellerAgreementGuard denies every route it
 * guards to a seller who hasn't re-accepted a newly-published agreement
 * version - except the two routes that let them SEE and ACT on that fact
 * (checking current-version status, and accepting it), which must stay
 * reachable or the seller could never get unstuck. Same explicit-opt-in
 * shape as `@AllowReviewer()`.
 */
export const SkipAgreementCheck = () => SetMetadata(SKIP_AGREEMENT_CHECK_KEY, true);
