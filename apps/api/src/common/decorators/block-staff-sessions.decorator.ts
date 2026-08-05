import { SetMetadata } from "@nestjs/common";

export const BLOCK_STAFF_SESSIONS_KEY = "blockStaffSessions";

/**
 * SRS §5.52/FR-52.2 - billing/payment-instructions/wallet/plan are never
 * assignable to a staff scope, owner-only always. See
 * BlockStaffSessionsGuard - this is the decorator half of that pair,
 * modeled directly on @BlockDuringImpersonation()'s shape.
 */
export const BlockStaffSessions = () => SetMetadata(BLOCK_STAFF_SESSIONS_KEY, true);
