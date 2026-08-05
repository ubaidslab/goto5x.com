import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { EventsService } from "../events/events.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { CreateStaffAccountDto } from "./dto/create-staff-account.dto";

const BCRYPT_ROUNDS = 12;

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  scopes: true,
  status: true,
  createdAt: true,
  revokedAt: true,
} as const;

/**
 * SRS §5.52/FR-52.1-52.6. Owner-only (never reachable by a staff session
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

  /** FR-52.5 - plan-tier limit check, same check-then-act shape as ProductsService.create()'s catalog.product_limit gate. */
  async create(sellerId: string, dto: CreateStaffAccountDto) {
    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const maxAccounts = await this.settings.resolve<number>("staff.max_accounts", planContext);
    const existingCount = await this.prismaAdmin.staffAccount.count({ where: { sellerId, status: "active" } });
    if (existingCount >= maxAccounts) {
      throw new BadRequestException(`Your plan's staff account limit (${maxAccounts}) has been reached.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const created = await this.prismaAdmin.staffAccount.create({
      data: { sellerId, email: dto.email, passwordHash, name: dto.name, scopes: dto.scopes },
      select: SAFE_SELECT,
    });

    await this.events.emit({
      eventType: "staff_account.created",
      actorType: "seller",
      actorId: sellerId,
      entityType: "staff_account",
      entityId: created.id,
      metadata: { scopes: dto.scopes },
    });
    return created;
  }

  async list(sellerId: string) {
    return this.prismaAdmin.staffAccount.findMany({ where: { sellerId }, select: SAFE_SELECT, orderBy: { createdAt: "desc" } });
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
}
