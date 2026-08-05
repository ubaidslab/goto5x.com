import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
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
import { RequestTopUpDto } from "./dto/request-topup.dto";
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
  listTransactions(@CurrentSellerId() sellerId: string) {
    return this.wallet.getTransactionHistory(sellerId);
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
  listTransactions(@CurrentSupplierId() supplierId: string) {
    return this.supplierWallet.getTransactionHistory(supplierId);
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
  ) {}

  @Get()
  listPending() {
    return this.wallet.listPendingForAdmin();
  }

  @Post(":topUpId/verify")
  async verify(@Param("topUpId") topUpId: string, @CurrentUser() user: JwtAccessPayload) {
    const request = await this.prismaAdmin.walletTopUpRequest.findUnique({ where: { id: topUpId } });
    if (!request) throw new NotFoundException("Top-up request not found.");

    if (request.ownerType === "supplier") {
      return this.supplierWallet.verifyTopUp(topUpId, user.adminUserId!);
    }
    const verified = await this.wallet.verifyTopUp(topUpId, user.adminUserId!);
    await this.graceLadder.checkAndRestore(verified.ownerId);
    return verified;
  }

  @Post(":topUpId/reject")
  reject(@Param("topUpId") topUpId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.wallet.rejectTopUp(topUpId, user.adminUserId!);
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
