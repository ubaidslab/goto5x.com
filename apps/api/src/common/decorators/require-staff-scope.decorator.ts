import { SetMetadata } from "@nestjs/common";
import { StaffPermission, StaffScope } from "../types";

export const REQUIRE_STAFF_SCOPE_KEY = "requireStaffScope";

export interface RequiredStaffScope {
  scope: StaffScope;
  permission: StaffPermission;
}

/**
 * See StaffScopeGuard - this is the decorator half of that pair (SRS
 * §5.52/FR-52.2/52.3, permission split added by FR-52.8). `permission`
 * defaults to `write` when omitted - the stricter of the two, so a route
 * nobody got around to converting to an explicit `read` fails closed
 * (a read-only staff member simply can't reach it) rather than open.
 */
export const RequireStaffScope = (scope: StaffScope, permission: StaffPermission = "write") =>
  SetMetadata(REQUIRE_STAFF_SCOPE_KEY, { scope, permission } satisfies RequiredStaffScope);
