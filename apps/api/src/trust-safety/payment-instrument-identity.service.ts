import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, StorePaymentInstructions } from "@prisma/client";
import { fingerprintValue } from "./identity-crypto.util";
import { similarityScore } from "./string-similarity.util";
import { ManualReviewAdapter, TitleVerificationAdapter } from "./title-verification.adapter";

const HIGH_SIMILARITY_THRESHOLD = 0.7;

export interface PaymentInstructionsPatchInput {
  bankAccountNumber?: string;
  bankAccountTitle?: string;
  jazzcashNumber?: string;
  jazzcashAccountTitle?: string;
  easypaisaNumber?: string;
  easypaisaAccountTitle?: string;
  nameDeclaredSelfOwned?: boolean;
}

/**
 * SRS §5.30/FR-30.2-30.3 - the name-consistency rule and the payment-
 * fingerprint uniqueness enforcement. Runs INSIDE the same transaction
 * `PaymentInstructionsService.update()` already opens (via
 * TenantPrismaService.run()), so a rejected save never leaves a
 * half-written row.
 */
@Injectable()
export class PaymentInstrumentIdentityService {
  private readonly hmacSecret: string;
  private readonly titleVerification: TitleVerificationAdapter = new ManualReviewAdapter();

  constructor(private readonly config: ConfigService) {
    this.hmacSecret = this.config.getOrThrow<string>("IDENTITY_FINGERPRINT_HMAC_SECRET");
  }

  /**
   * Merges `patch` over `existing` to see the instrument set as it will be
   * AFTER this save, validates FR-30.2's title+checkbox requirement,
   * computes FR-30.3's fingerprints, and decides FR-30.2's
   * nameConsistencyStatus. Returns the extra fields to merge into the
   * Prisma `update()` data - never writes anything itself.
   */
  async prepareUpdate(
    existing: StorePaymentInstructions,
    patch: PaymentInstructionsPatchInput,
    sellerLegalName: string,
  ): Promise<Partial<StorePaymentInstructions>> {
    const bankAccountNumber = patch.bankAccountNumber ?? existing.bankAccountNumber;
    const bankAccountTitle = patch.bankAccountTitle ?? existing.bankAccountTitle;
    const jazzcashNumber = patch.jazzcashNumber ?? existing.jazzcashNumber;
    const jazzcashAccountTitle = patch.jazzcashAccountTitle ?? existing.jazzcashAccountTitle;
    const easypaisaNumber = patch.easypaisaNumber ?? existing.easypaisaNumber;
    const easypaisaAccountTitle = patch.easypaisaAccountTitle ?? existing.easypaisaAccountTitle;
    const nameDeclaredSelfOwned = patch.nameDeclaredSelfOwned ?? existing.nameDeclaredSelfOwned;

    const declaredTitles: string[] = [];
    if (bankAccountNumber) {
      if (!bankAccountTitle) throw new BadRequestException("A bank account title is required alongside a bank account number.");
      declaredTitles.push(bankAccountTitle);
    }
    if (jazzcashNumber) {
      if (!jazzcashAccountTitle) throw new BadRequestException("A JazzCash account title is required alongside a JazzCash number.");
      declaredTitles.push(jazzcashAccountTitle);
    }
    if (easypaisaNumber) {
      if (!easypaisaAccountTitle) throw new BadRequestException("An Easypaisa account title is required alongside an Easypaisa number.");
      declaredTitles.push(easypaisaAccountTitle);
    }
    if (declaredTitles.length > 0 && !nameDeclaredSelfOwned) {
      throw new BadRequestException(
        "Please confirm each payment account is registered in your own legal name before saving.",
      );
    }

    const result: Partial<StorePaymentInstructions> = {
      bankAccountNumberHash: bankAccountNumber ? fingerprintValue(bankAccountNumber, this.hmacSecret) : null,
      jazzcashNumberHash: jazzcashNumber ? fingerprintValue(jazzcashNumber, this.hmacSecret) : null,
      easypaisaNumberHash: easypaisaNumber ? fingerprintValue(easypaisaNumber, this.hmacSecret) : null,
    };

    if (declaredTitles.length === 0) {
      result.nameConsistencyStatus = "not_required";
      return result;
    }

    result.nameConsistencyStatus = await this.decideNameConsistency(declaredTitles, sellerLegalName);
    return result;
  }

  /** Translates the database's P2002 uniqueness violation on a fingerprint column into a clean hard-block error (FR-30.3). */
  translateFingerprintConflict(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new BadRequestException(
        "One of these payment account numbers is already registered to a different seller on this platform.",
      );
    }
    throw err;
  }

  private async decideNameConsistency(declaredTitles: string[], sellerLegalName: string) {
    const worstSimilarity = Math.min(...declaredTitles.map((title) => similarityScore(title, sellerLegalName)));
    if (worstSimilarity >= HIGH_SIMILARITY_THRESHOLD) {
      return "approved" as const;
    }
    // FR-30.4 seam: v1.0's ManualReviewAdapter always defers to a human -
    // swapping in a real title-verification API later changes only this
    // one call's result, never this method's control flow.
    const verification = await this.titleVerification.verify(declaredTitles.join(", "), sellerLegalName);
    return verification.outcome === "verified" ? ("approved" as const) : ("pending" as const);
  }
}
