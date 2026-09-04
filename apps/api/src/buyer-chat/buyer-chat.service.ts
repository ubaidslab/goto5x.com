import { randomBytes } from "crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { StorefrontService } from "../storefront/storefront.service";
import { PostMessageDto } from "./dto/post-message.dto";
import { StartChatDto } from "./dto/start-chat.dto";

function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * FR-66.3 (Module 83, v0.56) - live chat widget. Public/buyer-facing
 * methods run pre-auth via PrismaAdminService, gated only by knowing a
 * thread's unguessable accessToken - same precedent as
 * OrderStatusLookupService. Seller-facing methods run through
 * TenantPrismaService (RLS), same shape as SupportTickets/other seller-
 * scoped reads elsewhere in this codebase.
 */
@Injectable()
export class BuyerChatService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly storefront: StorefrontService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async startThread(dto: StartChatDto, ip: string) {
    const limit = await this.settings.resolve<number>("buyer_chat.start_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`buyer-chat-start-ip:${ip}`, limit);

    const store = await this.storefront.loadActiveStoreOrThrow(dto.hostname);
    const planContext = await this.subscriptions.getPlanContext(store.sellerId);
    const enabled = await this.settings.resolve<boolean>("buyer_chat.enabled", planContext);
    if (!enabled) throw new ForbiddenException("Live chat is not available for this store.");

    const accessToken = generateAccessToken();
    const thread = await this.prismaAdmin.buyerChatThread.create({
      data: {
        storeId: store.id,
        accessToken,
        buyerEmail: dto.buyerEmail,
        messages: { create: { storeId: store.id, authorType: "buyer", body: dto.body } },
      },
    });
    return { threadId: thread.id, accessToken };
  }

  async postBuyerMessage(accessToken: string, dto: PostMessageDto) {
    const thread = await this.findByAccessTokenOrThrow(accessToken);
    await this.prismaAdmin.buyerChatMessage.create({
      data: { threadId: thread.id, storeId: thread.storeId, authorType: "buyer", body: dto.body },
    });
    await this.prismaAdmin.buyerChatThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    return this.getMessages(accessToken);
  }

  async getMessages(accessToken: string) {
    const thread = await this.findByAccessTokenOrThrow(accessToken);
    const messages = await this.prismaAdmin.buyerChatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
    });
    const awayAfterMinutes = await this.settings.resolve<number>("buyer_chat.away_after_minutes", { storeId: thread.storeId });
    const lastMessage = messages[messages.length - 1];
    const sellerAway =
      !!lastMessage &&
      lastMessage.authorType === "buyer" &&
      Date.now() - lastMessage.createdAt.getTime() > awayAfterMinutes * 60_000;

    return {
      status: thread.status,
      sellerAway,
      messages: messages.map((m) => ({ id: m.id, authorType: m.authorType, body: m.body, createdAt: m.createdAt })),
    };
  }

  private async findByAccessTokenOrThrow(accessToken: string) {
    const thread = await this.prismaAdmin.buyerChatThread.findUnique({ where: { accessToken } });
    if (!thread) throw new NotFoundException("Chat thread not found.");
    return thread;
  }

  // --- Seller-facing (RLS-scoped) ---

  async listThreadsForSeller(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const threads = await tx.buyerChatThread.findMany({
        where: { storeId },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      return threads.map((t) => ({
        id: t.id,
        buyerEmail: t.buyerEmail,
        status: t.status,
        updatedAt: t.updatedAt,
        lastMessage: t.messages[0] ? { body: t.messages[0].body, authorType: t.messages[0].authorType } : null,
      }));
    });
  }

  async getThreadForSeller(sellerId: string, storeId: string, threadId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const thread = await tx.buyerChatThread.findFirst({
        where: { id: threadId, storeId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!thread) throw new NotFoundException("Chat thread not found.");
      return thread;
    });
  }

  async replyAsSeller(sellerId: string, storeId: string, threadId: string, dto: PostMessageDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const thread = await tx.buyerChatThread.findFirst({ where: { id: threadId, storeId } });
      if (!thread) throw new NotFoundException("Chat thread not found.");
      await tx.buyerChatMessage.create({ data: { threadId, storeId, authorType: "seller", body: dto.body } });
      return tx.buyerChatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    });
  }

  async closeThread(sellerId: string, storeId: string, threadId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const thread = await tx.buyerChatThread.findFirst({ where: { id: threadId, storeId } });
      if (!thread) throw new NotFoundException("Chat thread not found.");
      return tx.buyerChatThread.update({ where: { id: threadId }, data: { status: "closed" } });
    });
  }
}
