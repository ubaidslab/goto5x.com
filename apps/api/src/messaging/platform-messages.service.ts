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
        title: dto.title,
        body: dto.body,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        createdByAdminUserId: adminUserId,
      },
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

    return messages.filter((m) => (!m.startsAt || m.startsAt <= now) && (!m.endsAt || m.endsAt >= now));
  }
}
