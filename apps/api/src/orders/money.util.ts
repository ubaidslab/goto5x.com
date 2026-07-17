/** All order math is rounded to 2dp at the point of computation - never left to accumulate float drift into a stored `Decimal` column. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
