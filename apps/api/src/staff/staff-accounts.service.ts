import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { EventsService } from "../events/events.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { CreateStaffAccountDto } from "./dto/create-staff-account.dto";
import { ScopePermissionDto } from "./dto/scope-permission.dto";
import { UpdateStaffAccountDto } from "./dto/update-staff-account.dto";
import { summarizeStaffActivity } from "./staff-activity.util";
import { STAFF_ROLE_TEMPLATES } from "./staff-role-templates";

const BCRYPT_ROUNDS = 12;
const DEVICE_RESTRICTION_MIN_TIER_ORDER = 2; // RISE (SRS §5.52/FR-52.12)

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  status: true,
  createdAt: true,
  revokedAt: true,
  expiresAt: true,
  deviceRestrictionEnabled: true,
  scopePermissions: { select: { scope: true, permission: true } },
} as const;

function assertValidScopePermissions(scopePermissions: ScopePermissionDto[]): void {
  const seen = new Set<string>();
  for (const sp of scopePermissions) {
    if (seen.has(sp.scope)) throw new BadRequestException(`Scope "${sp.scope}" was specified more than once.`);
    seen.add(sp.scope);
    // FR-52.8 - analytics is always read-only; no write action exists for it.
    if (sp.scope === "analytics" && sp.permission === "write") {
      throw new BadRequestException('The "analytics" scope is always read-only.');
    }
  }
}

/**
 * SRS §5.52/FR-52.1-52.13. Owner-only (never reachable by a staff session
 * itself - StaffAccountsController carries @BlockStaffSessions()) CRUD
 * for a seller's staff sub-accounts. Deliberately seller-scoped, not
 * store-scoped - same "no RLS, explicit sellerId filter via
 * PrismaAdminService" discipline as SellerVerificationEmailsService.
 */
@Injectable()
export class StaffAccountsService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly subscriptions: SubscriptionsService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
  ) {}

  getRoleTemplates() {
    return STAFF_ROLE_TEMPLATES;
  }

  /**
   * SRS §5.52/FR-52.10 - run periodically by StaffAccountExpiryScheduler's
   * Worker. Flips status only (never deletes), same "revoke, don't
   * delete" shape as the owner-initiated revoke() above.
   */
  async runExpirySweep(): Promise<{ expired: number }> {
    const result = await this.prismaAdmin.staffAccount.updateMany({
      where: { status: "active", expiresAt: { lte: new Date() } },
      data: { status: "revoked", revokedAt: new Date() },
    });
    return { expired: result.count };
  }

  /** FR-52.5 - plan-tier limit check, same check-then-act shape as ProductsService.create()'s catalog.product_limit gate. */
  async create(sellerId: string, dto: CreateStaffAccountDto) {
    assertValidScopePermissions(dto.scopePermissions);

    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const maxAccounts = await this.settings.resolve<number>("staff.max_accounts", planContext);
    const existingCount = await this.prismaAdmin.staffAccount.count({ where: { sellerId, status: "active" } });
    if (existingCount >= maxAccounts) {
      throw new BadRequestException(`Your plan's staff account limit (${maxAccounts}) has been reached.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const created = await this.prismaAdmin.staffAccount.create({
      data: {
        sellerId,
        email: dto.email,
        passwordHash,
        name: dto.name,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scopePermissions: { createMany: { data: dto.scopePermissions } },
      },
      select: SAFE_SELECT,
    });

    await this.events.emit({
      eventType: "staff_account.created",
      actorType: "seller",
      actorId: sellerId,
      entityType: "staff_account",
      entityId: created.id,
      metadata: { scopePermissions: dto.scopePermissions },
    });
    return created;
  }

  async list(sellerId: string) {
    return this.prismaAdmin.staffAccount.findMany({ where: { sellerId }, select: SAFE_SELECT, orderBy: { createdAt: "desc" } });
  }

  /** FR-52.9 - every field here stays freely editable post-creation, whether it started from a template or not. */
  async update(sellerId: string, id: string, dto: UpdateStaffAccountDto) {
    const staff = await this.prismaAdmin.staffAccount.findUnique({ where: { id } });
    if (!staff || staff.sellerId !== sellerId) throw new NotFoundException("Staff account not found.");

    if (dto.scopePermissions) assertValidScopePermissions(dto.scopePermissions);

    if (dto.deviceRestrictionEnabled === true && !staff.deviceRestrictionEnabled) {
      const tierOrder = await this.subscriptions.getSellerTierOrder(sellerId);
      if (tierOrder < DEVICE_RESTRICTION_MIN_TIER_ORDER) {
        throw new ForbiddenException("Device-based access restriction requires the RISE plan or above.");
      }
    }

    await this.prismaAdmin.$transaction(async (tx) => {
      if (dto.scopePermissions) {
        await tx.staffScopePermission.deleteMany({ where: { staffAccountId: id } });
        await tx.staffScopePermission.createMany({
          data: dto.scopePermissions.map((sp) => ({ staffAccountId: id, scope: sp.scope, permission: sp.permission })),
        });
      }
      await tx.staffAccount.update({
        where: { id },
        data: {
          ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
          ...(dto.deviceRestrictionEnabled !== undefined ? { deviceRestrictionEnabled: dto.deviceRestrictionEnabled } : {}),
        },
      });
    });

    await this.events.emit({
      eventType: "staff_account.updated",
      actorType: "seller",
      actorId: sellerId,
      entityType: "staff_account",
      entityId: id,
      metadata: { ...dto },
    });

    return this.prismaAdmin.staffAccount.findUniqueOrThrow({ where: { id }, select: SAFE_SELECT });
  }

  async revoke(sellerId: string, id: string) {
    const staff = await this.prismaAdmin.staffAccount.findUnique({ where: { id } });
    if (!staff || staff.sellerId !== sellerId) throw new NotFoundException("Staff account not found.");

    const updated = await this.prismaAdmin.staffAccount.update({
      where: { id },
      data: { status: "revoked", revokedAt: new Date() },
      select: SAFE_SELECT,
    });
    await this.events.emit({
      eventType: "staff_account.revoked",
      actorType: "seller",
      actorId: sellerId,
      entityType: "staff_account",
      entityId: id,
      metadata: {},
    });
    return updated;
  }

  /** FR-52.12 - devices pending or approved for one staff account. */
  async listDevices(sellerId: string, staffAccountId: string) {
    const staff = await this.prismaAdmin.staffAccount.findUnique({ where: { id: staffAccountId } });
    if (!staff || staff.sellerId !== sellerId) throw new NotFoundException("Staff account not found.");
    return this.prismaAdmin.staffDevice.findMany({ where: { staffAccountId }, orderBy: { firstSeenAt: "desc" } });
  }

  async approveDevice(sellerId: string, staffAccountId: string, deviceId: string) {
    const staff = await this.prismaAdmin.staffAccount.findUnique({ where: { id: staffAccountId } });
    if (!staff || staff.sellerId !== sellerId) throw new NotFoundException("Staff account not found.");
    const device = await this.prismaAdmin.staffDevice.findUnique({ where: { uniq_staff_device: { staffAccountId, deviceId } } });
    if (!device) throw new NotFoundException("Device not found.");

    const updated = await this.prismaAdmin.staffDevice.update({
      where: { id: device.id },
      data: { approved: true, approvedAt: new Date(), revokedAt: null },
    });
    await this.events.emit({
      eventType: "staff_device.approved",
      actorType: "seller",
      actorId: sellerId,
      entityType: "staff_account",
      entityId: staffAccountId,
      metadata: { deviceId },
    });
    return updated;
  }

  /** Revoking keeps the row (audit trail) rather than deleting it - a subsequent login from this device needs fresh approval again. */
  async revokeDevice(sellerId: string, staffAccountId: string, deviceId: string) {
    const staff = await this.prismaAdmin.staffAccount.findUnique({ where: { id: staffAccountId } });
    if (!staff || staff.sellerId !== sellerId) throw new NotFoundException("Staff account not found.");
    const device = await this.prismaAdmin.staffDevice.findUnique({ where: { uniq_staff_device: { staffAccountId, deviceId } } });
    if (!device) throw new NotFoundException("Device not found.");

    const updated = await this.prismaAdmin.staffDevice.update({
      where: { id: device.id },
      data: { approved: false, revokedAt: new Date() },
    });
    await this.events.emit({
      eventType: "staff_device.revoked",
      actorType: "seller",
      actorId: sellerId,
      entityType: "staff_account",
      entityId: staffAccountId,
      metadata: { deviceId },
    });
    return updated;
  }

  /** FR-52.12's emergency action - every device across every one of this seller's staff accounts. */
  async revokeAllDevices(sellerId: string) {
    const staffIds = (await this.prismaAdmin.staffAccount.findMany({ where: { sellerId }, select: { id: true } })).map((s) => s.id);
    const result = await this.prismaAdmin.staffDevice.updateMany({
      where: { staffAccountId: { in: staffIds }, approved: true },
      data: { approved: false, revokedAt: new Date() },
    });
    await this.events.emit({
      eventType: "staff_device.revoked_all",
      actorType: "seller",
      actorId: sellerId,
      entityType: "seller",
      entityId: sellerId,
      metadata: { count: result.count },
    });
    return { revokedCount: result.count };
  }

  /**
   * FR-52.11 - a derived read over the existing Platform Event Log's
   * `staff_account.action` rows (StaffAuditInterceptor's own write path,
   * unchanged); no new table, no new write.
   */
  async getActivityLog(sellerId: string) {
    const staff = await this.prismaAdmin.staffAccount.findMany({ where: { sellerId }, select: { id: true, name: true, email: true } });
    const staffIds = staff.map((s) => s.id);
    if (staffIds.length === 0) return [];

    const events = await this.prismaAdmin.platformEvent.findMany({
      where: { eventType: "staff_account.action", actorId: { in: staffIds } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const staffNames = new Map(staff.map((s) => [s.id, s.name ?? s.email]));
    const parsed = events
      .map((e) => {
        const metadata = e.metadata as { method?: string; path?: string };
        if (!e.actorId || !metadata.method || !metadata.path) return null;
        return { staffAccountId: e.actorId, method: metadata.method, path: metadata.path, createdAt: e.createdAt };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return summarizeStaffActivity(parsed, staffNames);
  }
}
