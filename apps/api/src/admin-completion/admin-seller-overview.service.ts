import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { WalletService } from "../billing/wallet.service";
import { InvoicesService } from "../billing/invoices.service";
import { StoreHealthScoreService } from "../store-health/store-health-score.service";
import { TrustSafetyMonitorsService } from "../trust-safety/trust-safety-monitors.service";
import { SessionService } from "../auth/session.service";

/**
 * Module 25 (Admin Completion) - the seller-360 page's data source.
 * Aggregates across every module that already holds a slice of "everything
 * about this one seller" (profile, stores, wallet+ledger, invoices, health,
 * T&S flags, devices, program participation, timeline) rather than
 * inventing a new denormalized table - every field here is a read from a
 * service/table that already exists elsewhere in the admin surface, just
 * never in one response before this module.
 */
@Injectable()
export class AdminSellerOverviewService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly wallet: WalletService,
    private readonly invoices: InvoicesService,
    private readonly storeHealth: StoreHealthScoreService,
    private readonly monitors: TrustSafetyMonitorsService,
    private readonly sessions: SessionService,
  ) {}

  async getOverview(sellerId: string) {
    const seller = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId }, include: { user: true } });
    if (!seller) throw new NotFoundException("Seller not found.");

    const [
      storeRows,
      balance,
      recentLedger,
      invoiceRows,
      programs,
      cancellationRateFlags,
      pendingForeverRateFlags,
      bypassAttemptFlags,
      selfReferralFlags,
      devices,
      auditEntries,
      platformEvents,
    ] = await Promise.all([
      this.prismaAdmin.store.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } }),
      this.wallet.getBalance(sellerId),
      this.wallet.getTransactionHistory(sellerId),
      this.invoices.listForSeller(sellerId),
      this.prismaAdmin.programParticipant.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } }),
      this.monitors.cancellationRateFlags(),
      this.monitors.pendingForeverRateFlags(),
      this.monitors.bypassAttemptFlags(),
      this.monitors.selfReferralFlags(),
      this.sessions.listSessions(seller.userId),
      this.prismaAdmin.adminAuditLog.findMany({ where: { targetId: sellerId }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.prismaAdmin.platformEvent.findMany({ where: { entityId: sellerId }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

    const stores = await Promise.all(
      storeRows.map(async (store) => ({
        ...store,
        healthScore: (await this.storeHealth.latestForStore(store.id))?.score ?? null,
      })),
    );

    const trustSafety = {
      riskScore: seller.riskScore,
      cancellationRateFlag: cancellationRateFlags.find((f) => f.sellerId === sellerId) ?? null,
      pendingForeverRateFlag: pendingForeverRateFlags.find((f) => f.sellerId === sellerId) ?? null,
      bypassAttemptFlag: bypassAttemptFlags.find((f) => f.sellerId === sellerId) ?? null,
      selfReferralFlags: selfReferralFlags.filter((f) => f.referrerSellerId === sellerId || f.referredSellerId === sellerId),
    };

    const timeline = [
      ...auditEntries.map((e) => ({
        source: "audit_log" as const,
        createdAt: e.createdAt,
        action: e.action,
        adminUserId: e.adminUserId,
        beforeValue: e.beforeValue,
        afterValue: e.afterValue,
      })),
      ...platformEvents.map((e) => ({
        source: "platform_event" as const,
        createdAt: e.createdAt,
        action: e.eventType,
        adminUserId: e.actorType === "admin" ? e.actorId : null,
        beforeValue: null,
        afterValue: e.metadata,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      seller: {
        id: seller.id,
        businessName: seller.businessName,
        email: seller.user.email,
        kycStatus: seller.kycStatus,
        activationStatus: seller.activationStatus,
        lifecycleStatus: seller.lifecycleStatus,
        isTrusted: seller.isTrusted,
        createdAt: seller.createdAt,
      },
      stores,
      wallet: { balance, currency: "PKR", recentLedger: recentLedger.slice(0, 20) },
      invoices: invoiceRows,
      programs,
      trustSafety,
      devices,
      timeline,
    };
  }
}
