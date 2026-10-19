import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Paddle } from "@paddle/paddle-node-sdk";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { AuditLogService } from "../../admin/audit-log.service";
import { SettingsService } from "../../settings-registry/settings.service";
import { WalletGraceLadderService } from "../wallet-grace-ladder.service";
import { FoundingMembersService } from "./founding-members.service";
import { PaddleSubscriptionLifecycleService } from "./paddle-subscription-lifecycle.service";

const NOW = new Date("2026-10-19T00:00:00.000Z");

function buildService(overrides: {
  subscription?: Record<string, unknown> | null;
  refundRequest?: Record<string, unknown> | null;
  priorApprovedRefund?: Record<string, unknown> | null;
  refundWindowDays?: number;
  claimedOrdinal?: number | null;
  paddle?: Partial<Paddle> | null;
}) {
  const subscriptionRow = {
    sellerId: "seller-1",
    planId: "plan-go",
    billingInterval: "monthly",
    currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
    paddleSubscriptionId: null,
    lastPaddleTransactionId: "txn_old",
    lastPaddleChargedAt: new Date("2026-10-05T00:00:00.000Z"),
    plan: { price: 24, currency: "USD" },
    ...overrides.subscription,
  };

  const subscriptionUpdate = jest.fn().mockResolvedValue(subscriptionRow);
  const subscriptionFindUniqueOrThrow = jest.fn().mockResolvedValue(subscriptionRow);
  const subscriptionFindUnique = jest.fn().mockResolvedValue(overrides.subscription === null ? null : subscriptionRow);

  const tx = {
    subscription: {
      findUniqueOrThrow: subscriptionFindUniqueOrThrow,
      update: subscriptionUpdate,
    },
  };

  const refundRequestRow = {
    id: "refund-1",
    sellerId: "seller-1",
    paddleTransactionId: "txn_old",
    amount: 24,
    currency: "USD",
    status: "pending",
    paddleAdjustmentId: null,
    ...overrides.refundRequest,
  };

  const prismaAdmin = {
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    subscription: {
      findUniqueOrThrow: subscriptionFindUniqueOrThrow,
      findUnique: subscriptionFindUnique,
      update: subscriptionUpdate,
    },
    paddleRefundRequest: {
      create: jest.fn().mockResolvedValue(refundRequestRow),
      findFirst: jest.fn().mockResolvedValue(overrides.priorApprovedRefund ?? null),
      findUnique: jest.fn().mockResolvedValue(refundRequestRow),
      findUniqueOrThrow: jest.fn().mockResolvedValue(refundRequestRow),
      update: jest.fn().mockResolvedValue(refundRequestRow),
    },
  } as unknown as PrismaAdminService;

  const auditLog = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService;
  const settings = {
    resolve: jest.fn().mockResolvedValue(overrides.refundWindowDays ?? 14),
  } as unknown as SettingsService;
  const walletGraceLadder = {
    pauseActiveStoresForNonPayment: jest.fn().mockResolvedValue({ count: 1 }),
  } as unknown as WalletGraceLadderService;
  const foundingMembers = {
    claimOrdinalIfEligible: jest.fn().mockResolvedValue(overrides.claimedOrdinal === undefined ? 5 : overrides.claimedOrdinal),
  } as unknown as FoundingMembersService;
  const paddle = overrides.paddle === null ? null : ({ subscriptions: { update: jest.fn() }, adjustments: { create: jest.fn() }, ...overrides.paddle } as unknown as Paddle);

  const service = new PaddleSubscriptionLifecycleService(prismaAdmin, auditLog, settings, walletGraceLadder, foundingMembers, paddle);
  return { service, prismaAdmin, auditLog, settings, walletGraceLadder, foundingMembers, paddle, tx, subscriptionUpdate, subscriptionFindUniqueOrThrow };
}

describe("PaddleSubscriptionLifecycleService", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  describe("confirmCharge", () => {
    it("refuses a charge against a billingInterval of 'none' rather than silently miscomputing a date", async () => {
      const { service } = buildService({ subscription: { billingInterval: "none" } });
      await expect(
        service.confirmCharge({ sellerId: "seller-1", paddleSubscriptionId: "sub_1", paddleCustomerId: "cus_1", paddleTransactionId: "txn_1" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("on a genuinely first payment (no existing paddleSubscriptionId match), starts the period from now and claims a Founding Member ordinal", async () => {
      const { service, subscriptionUpdate, foundingMembers } = buildService({
        subscription: { paddleSubscriptionId: null },
        claimedOrdinal: 7,
      });

      await service.confirmCharge({ sellerId: "seller-1", paddleSubscriptionId: "sub_new", paddleCustomerId: "cus_1", paddleTransactionId: "txn_1" });

      expect(subscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "active", paddleSubscriptionId: "sub_new", lastPaddleTransactionId: "txn_1" }),
        }),
      );
      const firstCallArg = subscriptionUpdate.mock.calls[0][0];
      expect(firstCallArg.data.currentPeriodEnd.toISOString()).toBe("2026-11-19T00:00:00.000Z"); // addInterval(now, monthly)
      expect(foundingMembers.claimOrdinalIfEligible).toHaveBeenCalledTimes(1);
      expect(subscriptionUpdate).toHaveBeenCalledWith({
        where: { sellerId: "seller-1" },
        data: { isFoundingMember: true, foundingMemberOrdinal: 7 },
      });
    });

    it("on a renewal (paddleSubscriptionId already matches), advances from the existing currentPeriodEnd and never claims a Founding Member ordinal", async () => {
      const { service, subscriptionUpdate, foundingMembers } = buildService({
        subscription: { paddleSubscriptionId: "sub_existing", currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z") },
      });

      await service.confirmCharge({ sellerId: "seller-1", paddleSubscriptionId: "sub_existing", paddleCustomerId: "cus_1", paddleTransactionId: "txn_2" });

      const firstCallArg = subscriptionUpdate.mock.calls[0][0];
      expect(firstCallArg.data.currentPeriodEnd.toISOString()).toBe("2026-11-01T00:00:00.000Z"); // addInterval(currentPeriodEnd, monthly)
      expect(foundingMembers.claimOrdinalIfEligible).not.toHaveBeenCalled();
    });

    it("does not write the Founding Member flag when the counter is already full (claim returns null)", async () => {
      const { service, subscriptionUpdate } = buildService({ subscription: { paddleSubscriptionId: null }, claimedOrdinal: null });

      await service.confirmCharge({ sellerId: "seller-1", paddleSubscriptionId: "sub_new", paddleCustomerId: "cus_1", paddleTransactionId: "txn_1" });

      expect(subscriptionUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isFoundingMember: true }) }));
    });

    it("applies the six-month Paddle-side bonus-day sync only for a six_month subscription", async () => {
      const { service, paddle } = buildService({ subscription: { billingInterval: "six_month", paddleSubscriptionId: "sub_existing" } });

      await service.confirmCharge({ sellerId: "seller-1", paddleSubscriptionId: "sub_existing", paddleCustomerId: "cus_1", paddleTransactionId: "txn_3" });

      expect((paddle as unknown as { subscriptions: { update: jest.Mock } }).subscriptions.update).toHaveBeenCalledWith(
        "sub_existing",
        expect.objectContaining({ prorationBillingMode: "do_not_bill" }),
      );
    });
  });

  describe("applySixMonthBonusDays", () => {
    it("is a no-op when no Paddle client is configured", async () => {
      const { service, prismaAdmin } = buildService({ paddle: null });
      await service.applySixMonthBonusDays("seller-1");
      expect(prismaAdmin.subscription.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("drops the bonus for this cycle (logs, does not throw) when Paddle's own update call fails", async () => {
      const paddleUpdate = jest.fn().mockRejectedValue(new Error("Paddle API down"));
      const { service } = buildService({ paddle: { subscriptions: { update: paddleUpdate } as never }, subscription: { paddleSubscriptionId: "sub_1" } });

      await expect(service.applySixMonthBonusDays("seller-1")).resolves.toBeUndefined();
    });
  });

  describe("markCanceled", () => {
    it("no-ops when no subscription matches that Paddle subscription id", async () => {
      const { service, prismaAdmin } = buildService({ subscription: null });
      await service.markCanceled("sub_unknown");
      expect(prismaAdmin.subscription.update).not.toHaveBeenCalled();
    });

    it("marks the matching subscription cancelled", async () => {
      const { service, prismaAdmin } = buildService({ subscription: { id: "sub-row-1", paddleSubscriptionId: "sub_1" } });
      await service.markCanceled("sub_1");
      expect(prismaAdmin.subscription.update).toHaveBeenCalledWith({ where: { id: "sub-row-1" }, data: { status: "cancelled" } });
    });
  });

  describe("requestRefund", () => {
    it("throws NotFoundException when this seller has no recorded Paddle charge", async () => {
      const { service } = buildService({ subscription: { lastPaddleTransactionId: null, lastPaddleChargedAt: null } });
      await expect(service.requestRefund("seller-1")).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException once the 14-day window on the most recent charge has closed", async () => {
      const { service } = buildService({ subscription: { lastPaddleChargedAt: new Date("2026-09-01T00:00:00.000Z") } });
      await expect(service.requestRefund("seller-1")).rejects.toThrow(BadRequestException);
    });

    it("auto-approves and immediately ends entitlement when this is the account's first refund in 12 months", async () => {
      const { service, prismaAdmin, walletGraceLadder, paddle } = buildService({ priorApprovedRefund: null });

      const result = await service.requestRefund("seller-1");

      expect(result.status).toBe("approved");
      expect((paddle as unknown as { adjustments: { create: jest.Mock } }).adjustments.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "refund", transactionId: "txn_old", type: "full" }),
      );
      expect(prismaAdmin.subscription.update).toHaveBeenCalledWith({
        where: { sellerId: "seller-1" },
        data: { status: "cancelled", currentPeriodEnd: NOW },
      });
      expect(walletGraceLadder.pauseActiveStoresForNonPayment).toHaveBeenCalledWith("seller-1");
    });

    it("routes to admin review (refund-hopping guard) instead of auto-approving when a prior approved refund exists in the trailing 12 months", async () => {
      const { service, auditLog, paddle } = buildService({ priorApprovedRefund: { id: "refund-old" } });

      const result = await service.requestRefund("seller-1");

      expect(result.status).toBe("pending");
      expect((paddle as unknown as { adjustments: { create: jest.Mock } }).adjustments.create).not.toHaveBeenCalled();
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "billing.paddle_refund_requested" }));
    });

    it("still ends entitlement immediately even when Paddle's own refund API call fails", async () => {
      const failingPaddle = { adjustments: { create: jest.fn().mockRejectedValue(new Error("Paddle down")) }, subscriptions: { update: jest.fn() } };
      const { service, prismaAdmin, walletGraceLadder } = buildService({ priorApprovedRefund: null, paddle: failingPaddle as never });

      const result = await service.requestRefund("seller-1");

      expect(result.status).toBe("approved");
      expect(prismaAdmin.subscription.update).toHaveBeenCalledWith({
        where: { sellerId: "seller-1" },
        data: { status: "cancelled", currentPeriodEnd: NOW },
      });
      expect(walletGraceLadder.pauseActiveStoresForNonPayment).toHaveBeenCalledWith("seller-1");
    });
  });

  describe("adminApproveRefund / adminRejectRefund", () => {
    it("adminApproveRefund throws NotFoundException when the request doesn't exist", async () => {
      const { service, prismaAdmin } = buildService({});
      (prismaAdmin.paddleRefundRequest.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.adminApproveRefund("missing", "admin-1")).rejects.toThrow(NotFoundException);
    });

    it("adminApproveRefund throws BadRequestException when the request was already decided", async () => {
      const { service, prismaAdmin } = buildService({ refundRequest: { status: "approved" } });
      (prismaAdmin.paddleRefundRequest.findUnique as jest.Mock).mockResolvedValue({ id: "refund-1", status: "approved" });
      await expect(service.adminApproveRefund("refund-1", "admin-1")).rejects.toThrow(BadRequestException);
    });

    it("adminRejectRefund marks the request rejected and audit-logs it, without touching Paddle", async () => {
      const { service, prismaAdmin, auditLog, paddle } = buildService({});
      (prismaAdmin.paddleRefundRequest.findUnique as jest.Mock).mockResolvedValue({ id: "refund-1", status: "pending" });

      await service.adminRejectRefund("refund-1", "admin-1");

      expect(prismaAdmin.paddleRefundRequest.update).toHaveBeenCalledWith({
        where: { id: "refund-1" },
        data: { status: "rejected", decidedAt: NOW, decidedByAdminId: "admin-1" },
      });
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "billing.paddle_refund_rejected" }));
      expect((paddle as unknown as { adjustments: { create: jest.Mock } }).adjustments.create).not.toHaveBeenCalled();
    });

    it("adminRejectRefund throws BadRequestException when the request was already decided", async () => {
      const { service, prismaAdmin } = buildService({});
      (prismaAdmin.paddleRefundRequest.findUnique as jest.Mock).mockResolvedValue({ id: "refund-1", status: "rejected" });
      await expect(service.adminRejectRefund("refund-1", "admin-1")).rejects.toThrow(BadRequestException);
    });
  });
});
