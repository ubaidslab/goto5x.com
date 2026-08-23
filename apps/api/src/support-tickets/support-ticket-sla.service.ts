import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { EmailService } from "../notifications/email.service";

/**
 * SRS §5.6k/FR-8.18 (Module 90) - the 80%-of-SLA-window near-breach sweep.
 * "The responsible admin queue" (Module 90's own text) - no per-ticket
 * assignment/routing exists in this deliberately minimal ticket system
 * (disclosed scope), so every admin account is the queue.
 */
@Injectable()
export class SupportTicketSlaService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly email: EmailService,
  ) {}

  async runSweep(now = new Date()): Promise<{ flagged: number }> {
    const openTickets = await this.prismaAdmin.supportTicket.findMany({
      where: { status: "open", nearBreachNotifiedAt: null },
      include: { store: { select: { name: true } } },
    });

    const dueForFlag = openTickets.filter((ticket) => {
      const windowMs = ticket.slaDeadline.getTime() - ticket.createdAt.getTime();
      const eightyPercentPoint = ticket.createdAt.getTime() + windowMs * 0.8;
      return now.getTime() >= eightyPercentPoint;
    });
    if (dueForFlag.length === 0) return { flagged: 0 };

    const adminEmails = await this.prismaAdmin.adminUser.findMany({ include: { user: { select: { email: true } } } });

    for (const ticket of dueForFlag) {
      await this.prismaAdmin.supportTicket.update({ where: { id: ticket.id }, data: { nearBreachNotifiedAt: now } });
      for (const admin of adminEmails) {
        await this.email.sendTicketNearBreachEmail(admin.user.email, ticket.subject, ticket.store.name);
      }
    }

    return { flagged: dueForFlag.length };
  }
}
