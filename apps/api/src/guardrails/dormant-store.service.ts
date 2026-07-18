import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { EmailService } from "../notifications/email.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * SRS §5.23/FR-23.2 - a scheduled job progressing a Free-Plan store through
 * warning -> suspend -> archive at configurable thresholds. `archived` is
 * distinct from `suspended`: data retained, storefront permanently offline
 * until the seller re-engages (re-engagement itself is a future dashboard
 * action, not built here - this job only progresses the one-way lifecycle
 * forward).
 *
 * Each threshold is measured from the *previous* stage's own trigger, not
 * compounded from last_active_at (FR-23.2's "a further configurable
 * period" reads as relative to the prior transition, not to the original
 * inactivity). `dormant_warning_sent_at` anchors the suspend check;
 * `updated_at` (bumped automatically the moment this job sets
 * status = 'suspended') anchors the archive check - no third timestamp
 * column was needed beyond the two build-plan.md already pinned for this
 * table (last_active_at, dormant_warning_sent_at).
 */
@Injectable()
export class DormantStoreService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
  ) {}

  async runSweep(now = new Date()): Promise<{ warned: number; suspended: number; archived: number }> {
    const warningDays = await this.settings.resolve<number>("lifecycle.dormant_warning_days");
    const suspendDays = await this.settings.resolve<number>("lifecycle.dormant_suspend_days");
    const archiveDays = await this.settings.resolve<number>("lifecycle.dormant_archive_days");

    const warningCutoff = new Date(now.getTime() - warningDays * 24 * 60 * 60 * 1000);
    const suspendCutoff = new Date(now.getTime() - suspendDays * 24 * 60 * 60 * 1000);
    const archiveCutoff = new Date(now.getTime() - archiveDays * 24 * 60 * 60 * 1000);

    // Archive first (the furthest-along stage), then suspend, then warn -
    // a store already due for archive must not also be re-caught at an
    // earlier stage by a later query in this same sweep.
    const toArchive = await this.prismaAdmin.store.findMany({
      where: { status: "suspended", updatedAt: { lt: archiveCutoff } },
    });
    for (const store of toArchive) {
      await this.prismaAdmin.store.update({ where: { id: store.id }, data: { status: "archived" } });
    }

    const toSuspend = await this.prismaAdmin.store.findMany({
      where: { status: "active", dormantWarningSentAt: { lt: suspendCutoff } },
    });
    for (const store of toSuspend) {
      await this.prismaAdmin.store.update({ where: { id: store.id }, data: { status: "suspended" } });
    }

    const toWarn = await this.prismaAdmin.store.findMany({
      where: { status: "active", dormantWarningSentAt: null, lastActiveAt: { lt: warningCutoff } },
      include: { seller: { include: { user: true } } },
    });
    for (const store of toWarn) {
      await this.prismaAdmin.store.update({ where: { id: store.id }, data: { dormantWarningSentAt: now } });
      await this.email.sendDormantStoreWarning(store.seller.user.email, store.name);
    }

    return { warned: toWarn.length, suspended: toSuspend.length, archived: toArchive.length };
  }
}
