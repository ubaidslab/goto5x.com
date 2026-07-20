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
}

export interface AuthenticatedRequest extends Request {
  user: JwtAccessPayload;
}
