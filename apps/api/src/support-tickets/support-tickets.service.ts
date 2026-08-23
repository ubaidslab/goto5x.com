import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { AuditLogService } from "../admin/audit-log.service";

const HOUR_MS = 60 * 60 * 1000;

/**
 * SRS §5.6k/FR-8.18 (Module 90) - deliberately bare: a ticket is a subject,
 * a body, and a thread of plain-text replies. No rich text, attachments,
 * multi-department routing, or canned responses (disclosed scope). SLA
 * deadline is computed ONCE at creation from the store's plan's
 * support.sla_hours (FR-6.45, Module 68) - never recomputed if the plan
 * later changes, so a ticket's promised response time is fixed the moment
 * it's opened.
 */
@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(sellerId: string, storeId: string, userId: string, subject: string, body: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const planContext = await this.subscriptions.getPlanContext(sellerId);
      const slaHours = await this.settings.resolve<number>("support.sla_hours", planContext);
      const now = new Date();

      return tx.supportTicket.create({
        data: {
          storeId,
          subject,
          slaDeadline: new Date(now.getTime() + slaHours * HOUR_MS),
          messages: { create: { storeId, authorType: "seller", authorId: userId, body } },
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    });
  }

  async listForStore(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.supportTicket.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
    });
  }

  async getForStore(sellerId: string, storeId: string, ticketId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: { id: ticketId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!ticket || ticket.storeId !== storeId) throw new NotFoundException("Ticket not found.");
      return ticket;
    });
  }

  async replyAsSeller(sellerId: string, storeId: string, ticketId: string, userId: string, body: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket || ticket.storeId !== storeId) throw new NotFoundException("Ticket not found.");
      return tx.ticketMessage.create({ data: { ticketId, storeId, authorType: "seller", authorId: userId, body } });
    });
  }

  // --- Admin-facing (PrismaAdminService - no seller session to scope by) ---

  async listAllForAdmin(status?: "open" | "resolved") {
    return this.prismaAdmin.supportTicket.findMany({
      where: status ? { status } : undefined,
      include: { store: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async getForAdmin(ticketId: string) {
    const ticket = await this.prismaAdmin.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: "asc" } }, store: { select: { name: true } } },
    });
    if (!ticket) throw new NotFoundException("Ticket not found.");
    return ticket;
  }

  async replyAsAdmin(ticketId: string, adminUserId: string, body: string) {
    const ticket = await this.prismaAdmin.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Ticket not found.");
    return this.prismaAdmin.ticketMessage.create({
      data: { ticketId, storeId: ticket.storeId, authorType: "admin", authorId: adminUserId, body },
    });
  }

  async resolve(ticketId: string, adminUserId: string) {
    const before = await this.prismaAdmin.supportTicket.findUnique({ where: { id: ticketId } });
    if (!before) throw new NotFoundException("Ticket not found.");

    const after = await this.prismaAdmin.supportTicket.update({
      where: { id: ticketId },
      data: { status: "resolved", resolvedAt: new Date() },
    });

    await this.auditLog.record({
      adminUserId,
      action: "support.ticket_resolved",
      targetType: "support_ticket",
      targetId: ticketId,
      beforeValue: { status: before.status },
      afterValue: { status: after.status },
    });

    return after;
  }
}
