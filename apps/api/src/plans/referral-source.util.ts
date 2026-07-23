const REFERRAL_CODE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * SRS §5.33/FR-33.1 - the Growth & Partner Programs referral-source capture,
 * shipped standalone ahead of the programs themselves (see build-plan.md's
 * "Growth & Partner Programs slotting" note) because the data is
 * unbackfillable. No program tables exist yet to resolve a code against, so
 * this only validates shape (a plain slug, never blocking signup on a bad
 * one - an invalid code is simply treated the same as no code).
 */
export function resolveReferralSource(code: string | undefined | null): string | null {
  if (!code) return null;
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}
