import { Request } from "express";

export interface JwtAccessPayload {
  sub: string; // user id
  sellerId?: string;
  adminUserId?: string;
  adminRole?: "super_admin" | "support";
  mfaVerified?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: JwtAccessPayload;
}
