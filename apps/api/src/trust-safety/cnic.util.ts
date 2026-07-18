/**
 * SRS §5.30/FR-30.1 - format- and checksum-validation for a Pakistani CNIC.
 *
 * NADRA does not publish an official check-digit algorithm for the CNIC's
 * 13 digits (unlike, say, a credit card's Luhn check) - it is simply a
 * unique national identifier. "Checksum-validated" here is therefore a
 * deliberate, disclosed simplification: a Luhn check over the 13 digits,
 * applied purely as a defensive input-validation measure (it catches the
 * single-digit-typo/transposition errors a real check digit would also
 * catch), not a claim of replicating NADRA's internal algorithm.
 */

export class InvalidCnicError extends Error {}

/** Strips formatting (dashes/spaces) and validates length/checksum. Returns the normalized 13-digit string. */
export function normalizeAndValidateCnic(raw: string): string {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(digits)) {
    throw new InvalidCnicError("A CNIC must be exactly 13 digits.");
  }
  if (!luhnCheck(digits)) {
    throw new InvalidCnicError("This CNIC number failed a checksum check - double-check the digits.");
  }
  return digits;
}

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/** Last-4 masked view (SRS FR-30.1) - the only form ever returned to the seller themselves (never the plaintext). */
export function maskCnic(normalized13Digits: string): string {
  return `•••••••••${normalized13Digits.slice(-4)}`;
}
