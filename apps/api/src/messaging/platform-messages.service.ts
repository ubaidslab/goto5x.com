import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { CreatePlatformMessageDto } from "./dto/create-platform-message.dto";

/**
 * SRS FR-8.15 (extends FR-8.7) - in-app messaging across three channels
 * (banner/popup/in-app notification), each targeted (all/plan/seller) and
 * scheduled (start/end window). Global, admin-gated at the app layer - no
 * RLS, targeting is resolved here rather than via row-level security.
 */
@Injectable()
export class PlatformMessagesService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async create(dto: CreatePlatformMessageDto, adminUserId: string) {
    return this.prisma.platformMessage.create({
      data: {
        channel: dto.channel,
        targetType: dto.targetType ?? "all",
        targetPlanId: dto.targetType === "plan" ? dto.targetPlanId : undefined,
        targetSellerId: dto.targetType === "seller" ? dto.targetSellerId : undefined,
        targetSupplierId: dto.targetType === "supplier" ? dto.targetSupplierId : undefined,
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        maxShownCount: dto.maxShownCount,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        createdByAdminUserId: adminUserId,
      },
    });
  }

  /**
   * SRS §5.6k/FR-6.44 (Module 67) - a system-triggered banner (no admin
   * composed it - createdByAdminUserId stays null, same "system, not a
   * human admin" convention AuditLogService.record() already uses for
   * adminUserId). Given no start/end window here: the caller
   * (GatewayHealthService) is the source of truth for whether the
   * condition is still active, gated by PaymentGatewayHealthAlert's
   * sticky flag rather than this message's own expiry.
   */
  async createSystemBanner(sellerId: string, title: string, body: string) {
    return this.prisma.platformMessage.create({
      data: { channel: "banner", targetType: "seller", targetSellerId: sellerId, title, body },
    });
  }

  async listAll() {
    return this.prisma.platformMessage.findMany({ orderBy: { createdAt: "desc" } });
  }

  async remove(id: string) {
    const existing = await this.prisma.platformMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Message not found.");
    await this.prisma.platformMessage.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * The seller-facing read: every message whose targeting matches this
   * seller (all / their current plan / them specifically) and whose
   * schedule window - if any - currently includes now.
   */
  async listActiveFor(sellerId: string) {
    const context = await this.subscriptions.getPlanContext(sellerId);
    const now = new Date();

    const messages = await this.prisma.platformMessage.findMany({
      where: {
        OR: [
          { targetType: "all" },
          context.planId ? { targetType: "plan", targetPlanId: context.planId } : { id: "" },
          { targetType: "seller", targetSellerId: sellerId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const inWindow = messages.filter((m) => (!m.startsAt || m.startsAt <= now) && (!m.endsAt || m.endsAt >= now));
    return this.filterByShownLimit(inWindow, "sellerId", sellerId);
  }

  /**
   * Phase 3 item 17 (SRS FR-8.22) - the supplier-facing equivalent of
   * listActiveFor. Suppliers only ever see "all" broadcasts or messages
   * targeted specifically at them (targetType "supplier") - there is no
   * plan-targeted path for suppliers, unlike sellers.
   */
  async listActiveForSupplier(supplierId: string) {
    const now = new Date();

    const messages = await this.prisma.platformMessage.findMany({
      where: {
        OR: [{ targetType: "all" }, { targetType: "supplier", targetSupplierId: supplierId }],
      },
      orderBy: { createdAt: "desc" },
    });

    const inWindow = messages.filter((m) => (!m.startsAt || m.startsAt <= now) && (!m.endsAt || m.endsAt >= now));
    return this.filterByShownLimit(inWindow, "supplierId", supplierId);
  }

  /**
   * The shown-count-limit trigger only applies to the popup channel (the
   * one thing that actually tracks "shown" - banners/notifications just
   * render inline for as long as targeting/window match, same as before).
   * Messages without maxShownCount set are unaffected either way.
   */
  private async filterByShownLimit(
    messages: Awaited<ReturnType<PlatformMessagesService["listAll"]>>,
    viewerField: "sellerId" | "supplierId",
    viewerId: string,
  ) {
    const gated = messages.filter((m) => m.channel === "popup" && m.maxShownCount != null);
    if (gated.length === 0) return messages;

    const views = await this.prisma.platformMessageView.findMany({
      where: { messageId: { in: gated.map((m) => m.id) }, [viewerField]: viewerId },
    });
    const shownCountByMessageId = new Map(views.map((v) => [v.messageId, v.shownCount]));

    return messages.filter((m) => {
      if (m.channel !== "popup" || m.maxShownCount == null) return true;
      return (shownCountByMessageId.get(m.id) ?? 0) < m.maxShownCount;
    });
  }

  /**
   * Called by the seller/supplier client the moment a popup is actually
   * rendered, so the count reflects real shown events rather than every
   * fetch of the message list. Replaces the old sessionStorage-only
   * dismissal, which reset every session/device and couldn't enforce
   * maxShownCount at all.
   */
  async recordShownForSeller(sellerId: string, messageId: string) {
    return this.recordShown("sellerId", sellerId, messageId);
  }

  async recordShownForSupplier(supplierId: string, messageId: string) {
    return this.recordShown("supplierId", supplierId, messageId);
  }

  private async recordShown(viewerField: "sellerId" | "supplierId", viewerId: string, messageId: string) {
    const message = await this.prisma.platformMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException("Message not found.");

    const uniqueWhere =
      viewerField === "sellerId"
        ? { uniq_message_view_seller: { messageId, sellerId: viewerId } }
        : { uniq_message_view_supplier: { messageId, supplierId: viewerId } };

    return this.prisma.platformMessageView.upsert({
      where: uniqueWhere,
      create: { messageId, [viewerField]: viewerId, shownCount: 1, lastShownAt: new Date() },
      update: { shownCount: { increment: 1 }, lastShownAt: new Date() },
    });
  }
}
