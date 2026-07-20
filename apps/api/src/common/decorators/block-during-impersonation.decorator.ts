import { SetMetadata } from "@nestjs/common";

export const BLOCK_DURING_IMPERSONATION_KEY = "blockDuringImpersonation";

/**
 * Module 17 (FR-8.4, v0.23 impersonation-transparency amendment). Marks a
 * high-risk, money-moving route (mark-as-paid, payment-instruction
 * changes, payout/invoice actions) as unreachable while impersonating -
 * support can fix a seller's settings, never move money on their behalf.
 * Paired with ImpersonationWriteGuard, same opt-in-per-route shape as
 * @AllowReviewer() rather than a guard that has to know every route.
 */
export const BlockDuringImpersonation = () => SetMetadata(BLOCK_DURING_IMPERSONATION_KEY, true);
