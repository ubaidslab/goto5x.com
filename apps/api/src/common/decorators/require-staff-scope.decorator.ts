import { SetMetadata } from "@nestjs/common";
import { StaffScope } from "../types";

export const REQUIRE_STAFF_SCOPE_KEY = "requireStaffScope";

/** See StaffScopeGuard - this is the decorator half of that pair (SRS §5.52/FR-52.2/52.3). */
export const RequireStaffScope = (scope: StaffScope) => SetMetadata(REQUIRE_STAFF_SCOPE_KEY, scope);
