import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { CreatePromoCodeDto } from "./dto/create-promo-code.dto";

/**
 * FR-7.9 - a platform-level subscription-billing discount code, deliberately
 * a separate table/service from DiscountCodesService (store-level, checkout
 * discounts, §5.3) - the two are never interchangeable, proven by there
 * being no shared lookup path between them at all.
 *
 * Disclosed scope decision (see docs/build-plan.md's Module 14 note): v1.0
 * has no live seller-side plan-subscription-fee billing flow to actually
 * discount (Direct Seller Collection only mechanizes commission owed,
 * FR-6.16) - this service makes the redemption MECHANISM (limits, expiry,
 * targeting, one-redemption-per-seller) fully real and testable per
 * §14.7's checklist item, without wiring a discount into an invoice amount
 * that doesn't exist yet in v1.0.
 */
@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaRuntimeService) {}

  async create(adminUserId: string, dto: CreatePromoCodeDto) {
    const existing = await this.prisma.platformPromoCode.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("A promo code with this code already exists.");

    return this.prisma.platformPromoCode.create({
      data: {
        code: dto.code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        targetUserId: dto.targetUserId,
        maxRedemptions: dto.maxRedemptions ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdBy: adminUserId,
      },
    });
  }

  /**
   * Security-hardening fix (post-launch audit, same class of bug as
   * verifyOtp()/claimSubmissionCooldown()): the `redeemedCount >=
   * maxRedemptions` check below was a read-then-write race - concurrent
   * redemptions from DIFFERENT sellers could all read the same
   * pre-increment count, all pass the check, and all succeed past
   * `maxRedemptions` (the per-seller unique constraint only stops one
   * seller redeeming twice, it does nothing for the global cap). The
   * `$transaction` below closes it the same way
   * DiscountCodesService.validateAndApply() does: an atomic conditional
   * `updateMany` guarded by `redeemedCount: { lt: maxRedemptions }` in its
   * WHERE, with the affected-row-count checked, wrapped in the same
   * transaction as the per-seller redemption-row create so a duplicate
   * redemption (caught via the unique constraint) rolls back the claimed
   * slot instead of leaking a phantom redemption.
   */
  async redeem(sellerId: string, code: string) {
    const promo = await this.prisma.platformPromoCode.findUnique({ where: { code } });
    if (!promo) throw new NotFoundException("Promo code not found.");
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new BadRequestException("This promo code has expired.");
    }
    if (promo.redeemedCount >= promo.maxRedemptions) {
      throw new BadRequestException("This promo code has reached its redemption limit.");
    }
    if (promo.targetUserId) {
      const seller = await this.prisma.seller.findUnique({ where: { id: sellerId }, select: { userId: true } });
      if (!seller || seller.userId !== promo.targetUserId) {
        throw new ForbiddenException("This promo code is targeted at a different account.");
      }
    }

    const alreadyRedeemed = await this.prisma.platformPromoCodeRedemption.findUnique({
      where: { uniq_promo_redemption_seller: { promoCodeId: promo.id, sellerId } },
    });
    if (alreadyRedeemed) throw new BadRequestException("You have already redeemed this promo code.");

    try {
      return await this.prisma.$transaction(async (tx) => {
        const claim = await tx.platformPromoCode.updateMany({
          where: { id: promo.id, redeemedCount: { lt: promo.maxRedemptions } },
          data: { redeemedCount: { increment: 1 } },
        });
        if (claim.count === 0) {
          throw new BadRequestException("This promo code has reached its redemption limit.");
        }
        return tx.platformPromoCodeRedemption.create({
          data: { promoCodeId: promo.id, sellerId },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestException("You have already redeemed this promo code.");
      }
      throw err;
    }
  }
}
