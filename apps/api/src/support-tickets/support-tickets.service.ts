import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { AuditLogService } from "../admin/audit-log.service";
import { InvoicePdfService } from "../invoices/invoice-pdf.service";
import { ObjectStorageService } from "../media/object-storage.service";
import { renderSupportTicketReceiptHtml } from "./support-ticket-receipt-template";

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
  private readonly logger = new Logger(SupportTicketsService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly auditLog: AuditLogService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async create(sellerId: string, storeId: string, userId: string, subject: string, body: string) {
    const { store, ...ticket } = await this.tenantPrisma.run(sellerId, async (tx) => {
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
        include: { messages: { orderBy: { createdAt: "asc" } }, store: { select: { name: true } } },
      });
    });

    // FR-8.20 (Module 99) - best-effort, same "must never block the
    // triggering action" discipline as InvoicePdfService's other callers: a
    // rendering failure leaves receiptPdfUrl unset rather than failing the
    // ticket submission itself.
    const receiptPdfUrl = await this.generateReceiptPdf(ticket, store.name);
    if (!receiptPdfUrl) return ticket;

    return this.tenantPrisma.run(sellerId, (tx) => tx.supportTicket.update({
      where: { id: ticket.id },
      data: { receiptPdfUrl },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }));
  }

  private async generateReceiptPdf(
    ticket: { id: string; storeId: string; subject: string; createdAt: Date; slaDeadline: Date },
    storeName: string,
  ): Promise<string | null> {
    const html = renderSupportTicketReceiptHtml({
      storeName,
      ticketId: ticket.id,
      subject: ticket.subject,
      createdAt: ticket.createdAt,
      slaDeadline: ticket.slaDeadline,
    });
    const buffer = await this.invoicePdf.renderToBuffer(html);
    if (!buffer) return null;
    // Same "must never block the triggering action" discipline as
    // InvoicePdfService's own generate() - a storage failure here must
    // leave receiptPdfUrl unset, not fail the ticket submission itself.
    try {
      const key = `stores/${ticket.storeId}/support-tickets/${ticket.id}-receipt.pdf`;
      return await this.objectStorage.putObject(key, buffer, "application/pdf");
    } catch (err) {
      this.logger.warn(`Support-ticket receipt upload failed for ticket ${ticket.id}: ${(err as Error).message}`);
      return null;
    }
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
