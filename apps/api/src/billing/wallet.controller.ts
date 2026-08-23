import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuditLogService } from "../admin/audit-log.service";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentSupplierId } from "../common/decorators/current-supplier.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { BlockDuringImpersonation } from "../common/decorators/block-during-impersonation.decorator";
import { BlockStaffSessions } from "../common/decorators/block-staff-sessions.decorator";
import { BlockStaffSessionsGuard } from "../common/guards/block-staff-sessions.guard";
import { JwtAccessPayload } from "../common/types";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { AdjustSellerWalletDto } from "./dto/adjust-seller-wallet.dto";
import { BulkDecideWalletTopUpsDto } from "./dto/bulk-decide-wallet-topups.dto";
import { RequestTopUpDto } from "./dto/request-topup.dto";
import { ProgramCommissionService } from "./program-commission.service";
import { PlanFeeRenewalExportTrigger } from "./plan-fee-renewal-export.service";
import { SupplierWalletService } from "./supplier-wallet.service";
import { WalletGraceLadderService } from "./wallet-grace-ladder.service";
import { WalletService } from "./wallet.service";

/** Seller-facing wallet: FR-6.27's Balance/top-up/history screen. Owner-only always (SRS §5.52/FR-52.2). */
@Controller("sellers/me/wallet")
@UseGuards(JwtAuthGuard, BlockStaffSessionsGuard)
@BlockStaffSessions()
export class SellerWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  async getBalance(@CurrentSellerId() sellerId: string) {
    return { balance: await this.wallet.getBalance(sellerId) };
  }

  @Get("transactions")
  listTransactions(
    @CurrentSellerId() sellerId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.wallet.getTransactionHistory(sellerId, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  @Get("topup-requests")
  listTopUpRequests(@CurrentSellerId() sellerId: string) {
    return this.wallet.listOwnTopUpRequests(sellerId);
  }

  @Post("topup-requests")
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  async requestTopUp(@CurrentSellerId() sellerId: string, @Body() dto: RequestTopUpDto) {
    const currency = "PKR";
    const request = await this.wallet.requestTopUp(sellerId, dto.amount, currency);
    return { request, instructions: this.wallet.topUpInstructions(dto.amount, currency) };
  }

  /**
   * Module 73 (v0.38) - retires Module 59's combined signup-only preview.
   * Plan-fee-only now, and covers every due cycle (signup AND renewal),
   * not just signup: whichever amount is due right now.
   */
  @Get("plan-fee-payment")
  getPlanFeePaymentPreview(@CurrentSellerId() sellerId: string) {
    return this.wallet.getPlanFeePaymentPreview(sellerId, "PKR");
  }

  /** Module 73 (v0.38) - submits the one proof-of-payment for the plan fee due right now; the amount is computed server-side, never accepted from the client. */
  @Post("plan-fee-payment")
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  requestPlanFeePayment(@CurrentSellerId() sellerId: string) {
    return this.wallet.requestPlanFeePayment(sellerId, "PKR");
  }
}

/** Module 20 (SRS FR-7.10 supplement) - a supplier's own small wallet, same shape as the seller one above. */
@Controller("suppliers/me/wallet")
@UseGuards(JwtAuthGuard)
export class SupplierWalletController {
  constructor(private readonly supplierWallet: SupplierWalletService) {}

  @Get()
  async getBalance(@CurrentSupplierId() supplierId: string) {
    return { balance: await this.supplierWallet.getBalance(supplierId) };
  }

  @Get("transactions")
  listTransactions(
    @CurrentSupplierId() supplierId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.supplierWallet.getTransactionHistory(
      supplierId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get("topup-requests")
  listTopUpRequests(@CurrentSupplierId() supplierId: string) {
    return this.supplierWallet.listOwnTopUpRequests(supplierId);
  }

  @Post("topup-requests")
  async requestTopUp(@CurrentSupplierId() supplierId: string, @Body() dto: RequestTopUpDto) {
    const currency = "PKR";
    const request = await this.supplierWallet.requestTopUp(supplierId, dto.amount, currency);
    return { request, instructions: this.supplierWallet.topUpInstructions(dto.amount, currency) };
  }
}

/**
 * Module 17's admin invoice-verification screen, repurposed (FR-6.23): same
 * list-and-verify pattern, now top-ups instead of invoices - lists both
 * seller and supplier requests together, dispatching verify/reject to
 * whichever wallet actually owns the request.
 */
@Controller("admin/wallet-topups")
@UseGuards(AdminAuthGuard)
export class AdminWalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly supplierWallet: SupplierWalletService,
    private readonly graceLadder: WalletGraceLadderService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly programCommission: ProgramCommissionService,
    private readonly renewalExportTrigger: PlanFeeRenewalExportTrigger,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  listPending() {
    return this.wallet.listPendingForAdmin();
  }

  @Post(":topUpId/verify")
  verify(@Param("topUpId") topUpId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.verifyOne(topUpId, user.adminUserId!);
  }

  @Post(":topUpId/reject")
  reject(@Param("topUpId") topUpId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.wallet.rejectTopUp(topUpId, user.adminUserId!);
  }

  /**
   * SRS FR-8.17 (Module 89) - replaces the admin terminal's client-side
   * Promise.all fan-out over per-item /verify or /reject calls. Reuses
   * verify()/reject()'s exact per-item orchestration unchanged (each still
   * posts its own individual audit-log entry via WalletService/
   * SupplierWalletService internally - a disclosed, deliberate deviation
   * from a strict "one entry for the whole batch" reading of FR-8.17,
   * accepted here rather than refactoring WalletService's deeply-tested
   * verify flow) - and adds exactly one additional batch-summary entry on
   * top, so the batch itself is still auditable as a single unit.
   */
  @Post("bulk-decide")
  async bulkDecide(@Body() dto: BulkDecideWalletTopUpsDto, @CurrentUser() user: JwtAccessPayload) {
    const succeeded: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const topUpId of dto.topUpIds) {
      try {
        if (dto.decision === "verify") {
          await this.verifyOne(topUpId, user.adminUserId!);
        } else {
          await this.wallet.rejectTopUp(topUpId, user.adminUserId!);
        }
        succeeded.push(topUpId);
      } catch (err) {
        failed.push({ id: topUpId, reason: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    await this.auditLog.record({
      adminUserId: user.adminUserId!,
      action: dto.decision === "verify" ? "billing.wallet_topups_bulk_verified" : "billing.wallet_topups_bulk_rejected",
      targetType: "wallet_topup_request",
      beforeValue: { topUpIds: dto.topUpIds },
      afterValue: { succeeded, failed },
    });

    return { succeeded, failed };
  }

  private async verifyOne(topUpId: string, adminUserId: string) {
    const request = await this.prismaAdmin.walletTopUpRequest.findUnique({ where: { id: topUpId } });
    if (!request) throw new NotFoundException("Top-up request not found.");

    if (request.ownerType === "supplier") {
      return this.supplierWallet.verifyTopUp(topUpId, adminUserId);
    }
    const { request: verified, isRenewal } = await this.wallet.verifyTopUp(topUpId, adminUserId);
    await this.graceLadder.checkAndRestore(verified.ownerId);

    // Module 73 (v0.38) - every plan-fee payment (signup OR renewal) lands
    // here now, not just Module 59's old combined-signup-only path.
    if (verified.planFeePortion !== null) {
      // The plan-fee-payment counterpart to checkAndRestore() above -
      // unconditional, since payment verification IS the gate now (there's
      // no wallet-balance threshold left to also check).
      await this.graceLadder.restoreAfterPlanFeePayment(verified.ownerId);
      // FR-33.4 - referral commission accrues off a paid plan-fee amount;
      // kept as a separate step (not inside WalletService itself) because
      // ProgramCommissionService already depends on WalletService, so the
      // accrual can't live inside WalletService without a circular
      // provider dependency.
      await this.programCommission.accrueReferralCommissionIfApplicable(
        verified.ownerId,
        Number(verified.planFeePortion),
        verified.currency,
        isRenewal,
      );
      // Module 24 (FR-36.1(a)) - a RENEWAL export, never a first-payment
      // one (there's nothing to export yet for a brand-new seller). Pushed
      // through PlanFeeRenewalExportTrigger's own queue rather than
      // injecting DataExportService directly, which would create a real
      // module cycle (see that service's docstring).
      if (isRenewal) {
        await this.renewalExportTrigger.trigger(verified.ownerId);
      }
    }
    return verified;
  }

  /** Module 25 (Admin Completion) - the seller-360 page's "adjust wallet" inline action. */
  @Post("sellers/:sellerId/adjust")
  adjust(@Param("sellerId") sellerId: string, @Body() dto: AdjustSellerWalletDto, @CurrentUser() user: JwtAccessPayload) {
    return this.wallet.adminManualAdjust(sellerId, dto.amount, "PKR", dto.reason, user.adminUserId!);
  }
}

/** FR-6.21 - the explicit "go live" action; a distinct small controller so tenancy/stores.module.ts doesn't need to depend on billing. */
@Controller("stores")
@UseGuards(JwtAuthGuard)
export class StorePublishController {
  constructor(private readonly graceLadder: WalletGraceLadderService) {}

  @Post(":storeId/publish")
  publish(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.graceLadder.publish(sellerId, storeId);
  }
}
