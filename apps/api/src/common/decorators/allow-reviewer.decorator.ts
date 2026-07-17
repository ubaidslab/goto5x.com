import { SetMetadata } from "@nestjs/common";

export const ALLOW_REVIEWER_KEY = "allowReviewer";

/**
 * Module 6 (SRS §4/FR-27.6). Marks a route as reachable by the narrowly-
 * scoped REVIEWER admin sub-role - AdminAuthGuard denies every other admin
 * route to that role by default, so this is an explicit opt-in per route,
 * not a per-controller escape hatch that could accidentally widen.
 */
export const AllowReviewer = () => SetMetadata(ALLOW_REVIEWER_KEY, true);
