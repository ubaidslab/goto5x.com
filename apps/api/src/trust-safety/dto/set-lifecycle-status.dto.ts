import { IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export const LIFECYCLE_STATUSES = ["active", "warned", "restricted", "suspended", "banned"] as const;

/**
 * Founder walkthrough finding (Phase 2 item 16): `suspended`/`banned` are
 * the two statuses that actually enforce (they now block/hide the
 * seller's storefront - see StorefrontService.loadActiveStoreOrThrow), so
 * setting either of those requires the admin's own TOTP re-verification
 * (mfaCode) instead of just the typed-value confirm dialog every other
 * admin action uses. `until` is only meaningful when status is
 * "suspended" - omitted (or set to "suspended" without it) means
 * indefinite, requiring an explicit admin action to lift.
 */
export class SetLifecycleStatusDto {
  @IsIn(LIFECYCLE_STATUSES)
  status!: (typeof LIFECYCLE_STATUSES)[number];

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
