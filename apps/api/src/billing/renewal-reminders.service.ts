import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { EmailService } from "../notifications/email.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k/FR-6.42 (Module 65) - the pre-expiry reminder ladder (7/3/1
 * days before `Subscription.currentPeriodEnd`, plus an expiry-day email)
 * and the win-back ladder (3/7/14 days into a store's terminalPausedAt
 * window, Module 64's same non-payment pause). Both use every trigger's
 * admin-editable EmailTemplate row (EmailService.sendTemplatedEmail) -
 * none are gated by an opt-out, since these are transactional lifecycle
 * notices, the same category as every other triggered email in this
 * codebase (see the SRS text's correction of §5.6i's original claim that a
 * general seller notification opt-out exists for these - it doesn't;
 * `Seller.newsletterOptOut` only ever covered the admin-composed platform
 * newsletter).
 */
@Injectable()
export class RenewalRemindersService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly email: EmailService,
  ) {}

  async runSweep(now = new Date()): Promise<{ preExpiry: number; winback: number }> {
    const preExpiry = await this.sendPreExpiryAndExpiryDayReminders(now);
    const winback = await this.sendWinbackReminders(now);
    return { preExpiry, winback };
  }

  private async sendPreExpiryAndExpiryDayReminders(now: Date): Promise<number> {
    const milestones: { daysBefore: number; field: "renewalReminderDay7SentAt" | "renewalReminderDay3SentAt" | "renewalReminderDay1SentAt" }[] = [
      { daysBefore: 7, field: "renewalReminderDay7SentAt" },
      { daysBefore: 3, field: "renewalReminderDay3SentAt" },
      { daysBefore: 1, field: "renewalReminderDay1SentAt" },
    ];

    // Individual, paid, currently-cycling subscriptions only - the same
    // filter PlanFeeDebitService.debitDuePlanFees() applies (team-sponsored
    // members carry currentPeriodEnd: null and never appear here).
    const subscriptions = await this.prismaAdmin.subscription.findMany({
      where: { sellerId: { not: null }, currentPeriodEnd: { not: null } },
      include: { plan: true, seller: { include: { user: { select: { email: true } } } } },
    });

    let sentCount = 0;
    for (const subscription of subscriptions) {
      if (subscription.plan.planGroup !== "individual" || Number(subscription.plan.price) <= 0) continue;
      const daysUntilExpiry = (subscription.currentPeriodEnd!.getTime() - now.getTime()) / DAY_MS;
      const to = subscription.seller!.user.email;
      const placeholders = { businessName: subscription.seller!.businessName };

      for (const milestone of milestones) {
        if (daysUntilExpiry > milestone.daysBefore) continue;
        if (daysUntilExpiry < 0) continue; // already expired - the expiry-day/win-back path takes over
        if (subscription[milestone.field]) continue;
        await this.email.sendTemplatedEmail(`renewal_reminder_day${milestone.daysBefore}`, to, placeholders);
        await this.prismaAdmin.subscription.update({ where: { id: subscription.id }, data: { [milestone.field]: now } });
        sentCount += 1;
      }

      if (daysUntilExpiry <= 0 && !subscription.renewalReminderExpiryDaySentAt) {
        await this.email.sendTemplatedEmail("renewal_reminder_expiry_day", to, placeholders);
        await this.prismaAdmin.subscription.update({ where: { id: subscription.id }, data: { renewalReminderExpiryDaySentAt: now } });
        sentCount += 1;
      }
    }
    return sentCount;
  }

  private async sendWinbackReminders(now: Date): Promise<number> {
    const milestones: { day: number; field: "winbackDay3SentAt" | "winbackDay7SentAt" | "winbackDay14SentAt" }[] = [
      { day: 3, field: "winbackDay3SentAt" },
      { day: 7, field: "winbackDay7SentAt" },
      { day: 14, field: "winbackDay14SentAt" },
    ];

    const pausedStores = await this.prismaAdmin.store.findMany({
      where: { status: "orders_paused", terminalPausedAt: { not: null } },
      include: { seller: { include: { user: { select: { email: true } } } } },
    });

    let sentCount = 0;
    for (const store of pausedStores) {
      const daysSincePaused = Math.floor((now.getTime() - store.terminalPausedAt!.getTime()) / DAY_MS);
      const placeholders = { businessName: store.seller.businessName };
      for (const milestone of milestones) {
        if (daysSincePaused < milestone.day) continue;
        if (store[milestone.field]) continue;
        await this.email.sendTemplatedEmail(`winback_day${milestone.day}`, store.seller.user.email, placeholders);
        await this.prismaAdmin.store.update({ where: { id: store.id }, data: { [milestone.field]: now } });
        sentCount += 1;
      }
    }
    return sentCount;
  }
}
