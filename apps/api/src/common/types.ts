import { Request } from "express";

export interface JwtAccessPayload {
  sub: string; // user id
  sellerId?: string;
  supplierId?: string;
  adminUserId?: string;
  adminRole?: "super_admin" | "support" | "reviewer";
  mfaVerified?: boolean;
  // Module 17 (FR-8.4 + v0.23 impersonation-transparency amendment) - set
  // only on a token issued by AdminImpersonationService.start(). Their
  // presence is what ImpersonationWriteGuard/ImpersonationAuditInterceptor
  // key off of - a normal seller token never has these.
  impersonatingAdminUserId?: string;
  impersonationSessionId?: string;
  // Module 35 (SRS §5.52/FR-52.2-52.3) - set only on a token issued by
  // StaffAuthService.login(). `sellerId` above is still the OWNER's
  // seller id (so every existing @CurrentSellerId()-based controller/
  // service and RLS - which keys off sellerId, not sub - resolve tenant
  // scope correctly with zero changes), while these two fields are what
  // StaffScopeGuard keys off of to restrict which routes the session can
  // reach. A normal seller/owner token never has these.
  staffAccountId?: string;
  // Module 97 (SRS §5.52/FR-52.8) - replaces the old bare `scopes:
  // StaffScope[]`; a map from held scope to its permission level, so
  // StaffScopeGuard can check `write` is actually held, not merely that
  // the scope is present at all.
  scopePermissions?: Partial<Record<StaffScope, StaffPermission>>;
}

// Module 35 (SRS §5.52/FR-52.2), expanded by Module 97 (FR-52.7) - coarse,
// explicit, auditable scopes, same discipline as AdminRole's 3-value enum,
// not a generic permissions framework. `design` is theme customization +
// storefront branding only (no orders/catalog/customer/discount access) -
// a seller can hand a contracted designer store-design-only access.
export type StaffScope =
  | "orders"
  | "catalog"
  | "discounts"
  | "customers"
  | "design"
  | "analytics"
  | "marketing"
  | "reviews"
  | "suppliers";

// Module 97 (SRS §5.52/FR-52.8) - `write` implies `read`; `analytics` is
// always `read` (no write action exists for it).
export type StaffPermission = "read" | "write";

export interface AuthenticatedRequest extends Request {
  user: JwtAccessPayload;
}
