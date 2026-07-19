import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { EventsService } from "../events/events.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { AcceptTeamInviteDto } from "./dto/accept-team-invite.dto";
import { CreateTeamDto } from "./dto/create-team.dto";
import { InviteTeamMemberDto } from "./dto/invite-team-member.dto";

/**
 * SRS §5.31 (FR-7.11-7.16) - Teams & Community Sponsorship. `teams`/
 * `team_members` are global tables (no RLS, same as `plans`/`subscriptions`)
 * - a leader's own team membership isn't tenant-scoped data.
 */
@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly events: EventsService,
  ) {}

  /** FR-7.11 - leader eligibility is the leader's own INDIVIDUAL plan tier bundling teams.leader_eligible (FR-7.16), checked at creation only. */
  async createTeam(leaderSellerId: string, dto: CreateTeamDto) {
    const context = await this.subscriptions.getPlanContext(leaderSellerId);
    const eligible = await this.settings.resolve<boolean>("teams.leader_eligible", context);
    if (!eligible) {
      throw new ForbiddenException("Your current plan does not include team-leader eligibility.");
    }

    const teamPlan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!teamPlan || teamPlan.planGroup !== "team" || !teamPlan.isActive) {
      throw new BadRequestException("That is not a valid Team tier.");
    }

    const team = await this.prisma.team.create({
      data: { leaderSellerId, name: dto.name, planId: dto.planId },
    });
    await this.events.emit({
      eventType: "team.created",
      actorType: "seller",
      actorId: leaderSellerId,
      entityType: "team",
      entityId: team.id,
    });
    return team;
  }

  async listMine(leaderSellerId: string) {
    return this.prisma.team.findMany({ where: { leaderSellerId }, include: { plan: true } });
  }

  /** The invitee's own view - how a seller discovers a pending invite exists at all, to then accept/decline it. */
  async listMyMembership(sellerId: string) {
    return this.prisma.teamMember.findMany({
      where: { sellerId },
      include: { team: { include: { plan: true, leader: { select: { businessName: true } } } } },
      orderBy: { invitedAt: "desc" },
    });
  }

  /** FR-7.11 - mirrors StoreSupplierLink's invite-by-email pattern: the invitee must already have an account. */
  async inviteMember(leaderSellerId: string, teamId: string, dto: InviteTeamMemberDto) {
    const team = await this.requireOwnedTeam(leaderSellerId, teamId);

    const invitedUser = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { seller: true } });
    if (!invitedUser?.seller) {
      throw new BadRequestException("No seller account exists for that email.");
    }
    if (invitedUser.seller.id === leaderSellerId) {
      throw new BadRequestException("You cannot invite yourself.");
    }

    const activeElsewhere = await this.prisma.teamMember.findFirst({
      where: { sellerId: invitedUser.seller.id, status: "active" },
    });
    if (activeElsewhere) {
      throw new ConflictException("This seller is already an active member of a team.");
    }

    const member = await this.prisma.teamMember.create({
      data: { teamId: team.id, sellerId: invitedUser.seller.id },
    });
    await this.events.emit({
      eventType: "team_member.invited",
      actorType: "seller",
      actorId: leaderSellerId,
      entityType: "team_member",
      entityId: member.id,
    });
    return member;
  }

  /** FR-7.12 - binding consent: a team_members row cannot become 'active' without consentAccepted === true, enforced here, not just the UI. */
  async acceptInvite(sellerId: string, teamMemberId: string, dto: AcceptTeamInviteDto) {
    const invite = await this.prisma.teamMember.findUnique({ where: { id: teamMemberId } });
    if (!invite || invite.sellerId !== sellerId) throw new NotFoundException("Invite not found.");
    if (invite.status !== "pending_invite") throw new BadRequestException("This invite is no longer pending.");

    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: invite.teamId } });
    let member;
    try {
      member = await this.prisma.teamMember.update({
        where: { id: teamMemberId },
        data: { status: "active", consentAcceptedAt: new Date(), joinedAt: new Date() },
      });
    } catch (err) {
      // FR-7.11 - the partial unique index (idx_team_members_one_active_sponsorship,
      // raw SQL in the migration, not declared in schema.prisma) is the real
      // enforcement; this only turns its violation into a clean 409 instead
      // of a raw 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You are already an active member of another team - leave it first.");
      }
      throw err;
    }
    // FR-7.18 - the member's individual plan becomes whatever the leader's
    // Team tier grants, from the moment of acceptance.
    await this.subscriptions.sponsorMember(sellerId, team.id, team.planId);

    await this.events.emit({
      eventType: "team_member.joined",
      actorType: "seller",
      actorId: sellerId,
      entityType: "team_member",
      entityId: member.id,
    });
    return member;
  }

  async declineInvite(sellerId: string, teamMemberId: string) {
    const invite = await this.prisma.teamMember.findUnique({ where: { id: teamMemberId } });
    if (!invite || invite.sellerId !== sellerId) throw new NotFoundException("Invite not found.");
    if (invite.status !== "pending_invite") throw new BadRequestException("This invite is no longer pending.");

    return this.prisma.teamMember.update({
      where: { id: teamMemberId },
      data: { status: "declined", leftAt: new Date() },
    });
  }

  /** FR-7.13 - member-initiated, always available; graceful next-cycle downgrade, never an account/store penalty. */
  async leaveTeam(sellerId: string) {
    const membership = await this.prisma.teamMember.findFirst({ where: { sellerId, status: "active" } });
    if (!membership) throw new NotFoundException("You are not an active member of any team.");

    const member = await this.prisma.teamMember.update({
      where: { id: membership.id },
      data: { status: "left", leftAt: new Date() },
    });
    await this.subscriptions.scheduleDowngradeToFreeAtPeriodEnd(sellerId);

    await this.events.emit({
      eventType: "team_member.left",
      actorType: "seller",
      actorId: sellerId,
      entityType: "team_member",
      entityId: member.id,
    });
    return member;
  }

  /**
   * FR-7.14 - leader's team dashboard: member list + a read-only per-member
   * sales/order-count/growth summary, computed via PrismaAdminService
   * (BYPASSRLS) since this deliberately crosses tenant boundaries - the
   * only thing ever returned is this aggregate, never a member's raw
   * products/orders/customers (that boundary is enforced by this method
   * simply not exposing any other query, not by a permission check that
   * could be bypassed).
   */
  async getTeamDashboard(leaderSellerId: string, teamId: string) {
    const team = await this.requireOwnedTeam(leaderSellerId, teamId);
    const members = await this.prisma.teamMember.findMany({
      where: { teamId: team.id },
      include: { seller: { select: { businessName: true } } },
      orderBy: { invitedAt: "desc" },
    });

    const withAnalytics = await Promise.all(
      members.map(async (member) => ({
        id: member.id,
        sellerId: member.sellerId,
        businessName: member.seller.businessName,
        status: member.status,
        invitedAt: member.invitedAt,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
        analytics: member.status === "active" ? await this.computeSalesSummary(member.sellerId) : null,
      })),
    );
    return { team, members: withAnalytics };
  }

  /**
   * FR-7.14/FR-28.1 - the same shape of summary a seller's own dashboard-
   * home screen would compute for itself. No such reusable computation
   * existed before this module (Module 10 built the CRUD screens but never
   * a sales/order-count/growth-trend aggregate) - built once, here, and
   * used identically for every member so a bug shows identically across
   * all of them rather than being a second, inconsistent metric engine.
   * Disclosed in docs/build-plan.md's Module 14 note.
   */
  private async computeSalesSummary(sellerId: string) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const priorWindowStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const stores = await this.prismaAdmin.store.findMany({ where: { sellerId }, select: { id: true } });
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) return { totalSales: 0, orderCount: 0, growthPercent: 0 };

    const [current, prior] = await Promise.all([
      this.prismaAdmin.order.aggregate({
        where: { storeId: { in: storeIds }, status: { not: "pending" }, placedAt: { gte: windowStart, lte: now } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prismaAdmin.order.aggregate({
        where: { storeId: { in: storeIds }, status: { not: "pending" }, placedAt: { gte: priorWindowStart, lt: windowStart } },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalSales = Number(current._sum.totalAmount ?? 0);
    const priorSales = Number(prior._sum.totalAmount ?? 0);
    const growthPercent = priorSales > 0 ? Math.round(((totalSales - priorSales) / priorSales) * 100) : 0;

    return { totalSales, orderCount: current._count, growthPercent };
  }

  private async requireOwnedTeam(leaderSellerId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.leaderSellerId !== leaderSellerId) {
      throw new NotFoundException("Team not found.");
    }
    return team;
  }
}
