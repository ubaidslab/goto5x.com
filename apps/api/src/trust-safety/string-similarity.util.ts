/**
 * SRS §5.30/FR-30.2 - "normalized string-similarity check (transliteration-
 * and whitespace/case-tolerant, since Urdu-to-Roman transliteration variance
 * is normal in Pakistan)". No string-similarity dependency exists anywhere
 * in this codebase (confirmed before writing this), so this is a small,
 * dependency-free Dice's-coefficient (bigram overlap) implementation - a
 * standard, well-understood choice for "reasonably tolerant of minor
 * spelling variance," not a claim of solving transliteration generally.
 */

/** Lowercases, trims, collapses whitespace, and strips punctuation so "Muhammad  Ali." and "muhammad ali" compare equal. */
export function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(value: string): string[] {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 2) return [compact];
  const grams: string[] = [];
  for (let i = 0; i < compact.length - 1; i++) {
    grams.push(compact.slice(i, i + 2));
  }
  return grams;
}

/** Dice's coefficient over character bigrams - 1.0 is an exact match, 0.0 is nothing in common. */
export function similarityScore(a: string, b: string): number {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  const gramsA = bigrams(normA);
  const gramsB = bigrams(normB);
  const counts = new Map<string, number>();
  for (const g of gramsA) counts.set(g, (counts.get(g) ?? 0) + 1);

  let matches = 0;
  for (const g of gramsB) {
    const remaining = counts.get(g) ?? 0;
    if (remaining > 0) {
      matches++;
      counts.set(g, remaining - 1);
    }
  }
  return (2 * matches) / (gramsA.length + gramsB.length);
}
