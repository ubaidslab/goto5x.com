/**
 * SRS §5.27/FR-27.1-27.4 - the pure rule-evaluation logic, deliberately
 * free of any DB/Settings-Registry access so it's trivially unit-testable.
 * `ModerationService` gathers the inputs (Settings Registry values, seller
 * trust flag, approved-product count) and calls this.
 */

export type ModerationOutcome = "not_required" | "pending";

export type ModerationReason = "new_seller_probation" | "restricted_keyword" | "restricted_category";

export interface ModerationDecision {
  status: ModerationOutcome;
  reason?: ModerationReason;
}

export interface ModerationDecisionInput {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  isTrusted: boolean;
  approvedProductCount: number;
  probationCount: number;
  bannedKeywords: string[];
  restrictedKeywords: string[];
  restrictedCategoryIds: string[];
  // Module 8 amendment (SRS §5.27, v0.13) - new-seller probation (FR-27.3)
  // stays scoped to self-fulfilled listings; a supplier-sourced listing
  // already has its own human gate (the seller's listing-review approval)
  // before it ever reaches this function, so probation would be a
  // redundant, seller-count-driven check that doesn't map to how supplier
  // listings actually get created. Every other rule (banned/restricted
  // keyword, restricted category, trusted bypass) applies identically.
  // Defaults to true so every pre-existing (self-fulfilled) call site is
  // unaffected.
  applyProbation?: boolean;
}

/** FR-27.1 - a banned keyword blocks submission outright, never merely queues it. */
export class BannedKeywordError extends Error {
  constructor(public readonly keyword: string) {
    super(`Banned keyword "${keyword}" found in listing content.`);
  }
}

function findKeyword(haystack: string, keywords: string[]): string | undefined {
  return keywords.find((keyword) => keyword.trim().length > 0 && haystack.includes(keyword.trim().toLowerCase()));
}

export function decideModerationStatus(input: ModerationDecisionInput): ModerationDecision {
  // FR-27.4 - a trusted seller bypasses everything below, including probation.
  if (input.isTrusted) return { status: "not_required" };

  const haystack = `${input.title} ${input.description ?? ""}`.toLowerCase();

  // FR-27.1 - checked first and unconditionally: a banned term blocks the
  // listing regardless of trust-adjacent state below it (trust is already
  // handled above; this line only runs for non-trusted sellers).
  const bannedMatch = findKeyword(haystack, input.bannedKeywords);
  if (bannedMatch) throw new BannedKeywordError(bannedMatch);

  // FR-27.3 - probation is mandatory for a new seller's first N products,
  // regardless of whether keyword/category rules would have flagged them
  // anyway - it is not merely "whichever check fires first." Scoped to
  // self-fulfilled listings only (applyProbation defaults true) - see this
  // field's doc comment above.
  const applyProbation = input.applyProbation ?? true;
  if (applyProbation && input.approvedProductCount < input.probationCount) {
    return { status: "pending", reason: "new_seller_probation" };
  }

  const restrictedMatch = findKeyword(haystack, input.restrictedKeywords);
  if (restrictedMatch) return { status: "pending", reason: "restricted_keyword" };

  if (input.categoryId && input.restrictedCategoryIds.includes(input.categoryId)) {
    return { status: "pending", reason: "restricted_category" };
  }

  return { status: "not_required" };
}
