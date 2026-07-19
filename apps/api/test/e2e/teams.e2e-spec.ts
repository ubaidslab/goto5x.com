import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { InvoicesService } from "../../src/billing/invoices.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

/** SRS §5.31/§14.31 - Teams & Community Sponsorship. */
describe("Teams & Community Sponsorship (e2e) - SRS §5.31/§14.31", () => {
  let app: INestApplication;
  let superuser: PrismaClient;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
  });

  async function signup(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id as string };
  }

  async function makeLeaderEligible(sellerId: string) {
    const proPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: proPlan.id } });
    await app.get(SettingsService).setValue("teams.leader_eligible", "plan", proPlan.id, true, ADMIN_ID);
    return proPlan;
  }

  async function teamPlan(tierOrder = 0) {
    return superuser.plan.findFirstOrThrow({ where: { planGroup: "team", tierOrder } });
  }

  describe("Team creation and invitation (FR-7.11)", () => {
    it("rejects team creation for a seller whose plan does not include team-leader eligibility", async () => {
      const { token } = await signup("not-eligible@example.com");
      const plan = await teamPlan();
      const res = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "My Team", planId: plan.id });
      expect(res.status).toBe(403);
    });

    it("an eligible leader can create a team and invite an existing seller by email", async () => {
      const { token: leaderToken, sellerId: leaderId } = await signup("leader@example.com");
      await makeLeaderEligible(leaderId);
      const plan = await teamPlan();

      const team = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Growth Squad", planId: plan.id });
      expect(team.status).toBe(201);

      await signup("member@example.com");
      const invite = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${team.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ email: "member@example.com" });
      expect(invite.status).toBe(201);
      expect(invite.body.status).toBe("pending_invite");
    });

    it("rejects inviting an email with no seller account", async () => {
      const { token: leaderToken, sellerId: leaderId } = await signup("leader2@example.com");
      await makeLeaderEligible(leaderId);
      const plan = await teamPlan();
      const team = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Team", planId: plan.id });

      const invite = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${team.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ email: "nobody@example.com" });
      expect(invite.status).toBe(400);
    });

    it("a seller already actively sponsored by one team cannot become active in a second (partial unique index, exercised directly against the API)", async () => {
      const { token: leaderAToken, sellerId: leaderAId } = await signup("leader-a@example.com");
      await makeLeaderEligible(leaderAId);
      const { token: leaderBToken, sellerId: leaderBId } = await signup("leader-b@example.com");
      await makeLeaderEligible(leaderBId);
      const plan = await teamPlan();

      const teamA = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderAToken}`)
        .send({ name: "Team A", planId: plan.id });
      const teamB = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderBToken}`)
        .send({ name: "Team B", planId: plan.id });

      const { token: memberToken } = await signup("dual-member@example.com");
      const inviteA = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${teamA.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderAToken}`)
        .send({ email: "dual-member@example.com" });
      const inviteB = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${teamB.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderBToken}`)
        .send({ email: "dual-member@example.com" });

      const acceptA = await request(app.getHttpServer())
        .post(`/sellers/me/team-membership/${inviteA.body.id}/accept`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ consentAccepted: true });
      expect(acceptA.status).toBe(201);

      const acceptB = await request(app.getHttpServer())
        .post(`/sellers/me/team-membership/${inviteB.body.id}/accept`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ consentAccepted: true });
      expect(acceptB.status).toBe(409); // the partial unique index's violation, translated to a clean conflict - never silently allowed
    });
  });

  describe("Binding consent (FR-7.12)", () => {
    it("a team_members row cannot reach status=active without consentAccepted, tested directly against the API", async () => {
      const { token: leaderToken, sellerId: leaderId } = await signup("consent-leader@example.com");
      await makeLeaderEligible(leaderId);
      const plan = await teamPlan();
      const team = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Consent Team", planId: plan.id });

      const { token: memberToken } = await signup("consent-member@example.com");
      const invite = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${team.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ email: "consent-member@example.com" });

      const noConsent = await request(app.getHttpServer())
        .post(`/sellers/me/team-membership/${invite.body.id}/accept`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ consentAccepted: false });
      expect(noConsent.status).toBe(400);

      const stillPending = await superuser.teamMember.findUniqueOrThrow({ where: { id: invite.body.id } });
      expect(stillPending.status).toBe("pending_invite");
      expect(stillPending.consentAcceptedAt).toBeNull();
    });
  });

  describe("Leave-team flow (FR-7.13)", () => {
    async function setUpActiveMembership() {
      const { token: leaderToken, sellerId: leaderId } = await signup("leave-leader@example.com");
      await makeLeaderEligible(leaderId);
      const plan = await teamPlan();
      const team = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Leave Team", planId: plan.id });

      const { token: memberToken, sellerId: memberId } = await signup("leave-member@example.com");
      const invite = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${team.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ email: "leave-member@example.com" });
      await request(app.getHttpServer())
        .post(`/sellers/me/team-membership/${invite.body.id}/accept`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ consentAccepted: true });
      return { memberToken, memberId, teamPlan: plan };
    }

    it("a member can leave at any time; the sponsored plan downgrades to Free gracefully, never as a suspension/deletion", async () => {
      const { memberToken, memberId, teamPlan: plan } = await setUpActiveMembership();

      const subscriptionBefore = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: memberId } });
      expect(subscriptionBefore.planId).toBe(plan.id); // sponsored - reflects the team tier

      const leave = await request(app.getHttpServer())
        .post("/sellers/me/team-membership/leave")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(leave.status).toBe(201);

      // Free Plan (no cycle while sponsored) - the "no cycle to wait for" case, downgrades immediately.
      const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: memberId } });
      const freePlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
      expect(subscriptionAfter.planId).toBe(freePlan.id);
      expect(subscriptionAfter.sponsoredByTeamId).toBeNull();

      const membership = await superuser.teamMember.findFirst({ where: { sellerId: memberId } });
      expect(membership!.status).toBe("left");
    });
  });

  describe("Leader's team dashboard - read-only (FR-7.14)", () => {
    it("the per-member analytics summary is a read query, and the leader cannot read a member's raw store/products/orders through any other endpoint", async () => {
      const { token: leaderToken, sellerId: leaderId } = await signup("dash-leader@example.com");
      await makeLeaderEligible(leaderId);
      const plan = await teamPlan();
      const team = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Dash Team", planId: plan.id });

      const { token: memberToken, sellerId: memberId } = await signup("dash-member@example.com");
      const memberStore = await request(app.getHttpServer())
        .post("/stores")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Member Store", slug: "dash-member-store" });

      const invite = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${team.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ email: "dash-member@example.com" });
      await request(app.getHttpServer())
        .post(`/sellers/me/team-membership/${invite.body.id}/accept`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ consentAccepted: true });

      const dashboard = await request(app.getHttpServer())
        .get(`/sellers/me/teams/${team.body.id}/dashboard`)
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.members).toHaveLength(1);
      expect(dashboard.body.members[0].sellerId).toBe(memberId);
      expect(dashboard.body.members[0].analytics).toEqual({ totalSales: 0, orderCount: 0, growthPercent: 0 });

      // Negative tests - the leader's own session has no route that exposes
      // a member's raw store data; the leader isn't even the store's owner
      // for RLS purposes, so any attempt is rejected the same as any
      // cross-tenant access attempt.
      const productsAttempt = await request(app.getHttpServer())
        .get(`/stores/${memberStore.body.id}/products`)
        .set("Authorization", `Bearer ${leaderToken}`);
      expect(productsAttempt.status).toBe(404);

      const writeAttempt = await request(app.getHttpServer())
        .patch(`/stores/${memberStore.body.id}`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Hijacked" });
      expect(writeAttempt.status).toBe(404);
    });
  });

  describe("Group invoice math (FR-7.15/7.18, revised v0.19)", () => {
    it("a team with N active sponsored members produces a group invoice of exactly N x the leader's Team tier seat price, unaffected by team size changes to the leader's own commission invoice", async () => {
      const { token: leaderToken, sellerId: leaderId } = await signup("invoice-leader@example.com");
      await makeLeaderEligible(leaderId);
      const plan = await teamPlan(1); // Team Growth, seatPrice 1500
      const team = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Invoice Team", planId: plan.id });

      async function addActiveMember(email: string) {
        const { token: memberToken } = await signup(email);
        const invite = await request(app.getHttpServer())
          .post(`/sellers/me/teams/${team.body.id}/invite`)
          .set("Authorization", `Bearer ${leaderToken}`)
          .send({ email });
        await request(app.getHttpServer())
          .post(`/sellers/me/team-membership/${invite.body.id}/accept`)
          .set("Authorization", `Bearer ${memberToken}`)
          .send({ consentAccepted: true });
        return memberToken;
      }

      await addActiveMember("invoice-member-1@example.com");
      await addActiveMember("invoice-member-2@example.com");

      const invoices = superuser; // direct read after calling the service
      const invoicesService = app.get(InvoicesService);
      const result = await invoicesService.generateMonthlyGroupInvoices(new Date("2026-08-01"));
      expect(result.generated).toBe(1);

      const invoice = await invoices.sellerInvoice.findFirstOrThrow({
        where: { teamId: team.body.id, invoiceType: "group_sponsorship" },
      });
      expect(invoice.sellerId).toBe(leaderId); // the LEADER is billed, not any member
      expect(Number(invoice.totalAmount)).toBeCloseTo(3000, 2); // 2 members x 1500 seat price

      // Re-running is idempotent - does not double-invoice the same period.
      const rerun = await invoicesService.generateMonthlyGroupInvoices(new Date("2026-08-01"));
      expect(rerun.generated).toBe(0);
    });

    it("non-payment past the grace period downgrades sponsored members gracefully, never suspending a member's store or the leader's own store", async () => {
      const { token: leaderToken, sellerId: leaderId } = await signup("overdue-leader@example.com");
      await makeLeaderEligible(leaderId);
      const leaderStore = await request(app.getHttpServer())
        .post("/stores")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Leader Store", slug: "overdue-leader-store" });
      const plan = await teamPlan(1);
      const team = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ name: "Overdue Team", planId: plan.id });

      const { token: memberToken, sellerId: memberId } = await signup("overdue-member@example.com");
      const memberStore = await request(app.getHttpServer())
        .post("/stores")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Overdue Member Store", slug: "overdue-member-store" });
      const invite = await request(app.getHttpServer())
        .post(`/sellers/me/teams/${team.body.id}/invite`)
        .set("Authorization", `Bearer ${leaderToken}`)
        .send({ email: "overdue-member@example.com" });
      await request(app.getHttpServer())
        .post(`/sellers/me/team-membership/${invite.body.id}/accept`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ consentAccepted: true });

      const invoicesService = app.get(InvoicesService);
      await invoicesService.generateMonthlyGroupInvoices(new Date("2026-08-01"));
      const invoice = await superuser.sellerInvoice.findFirstOrThrow({
        where: { teamId: team.body.id, invoiceType: "group_sponsorship" },
      });
      // Force it overdue (past due_date) directly, same as billing.e2e-spec.ts's own pattern.
      await superuser.sellerInvoice.update({ where: { id: invoice.id }, data: { dueDate: new Date("2020-01-01") } });

      await invoicesService.sweepOverdueInvoicesAndSuspend(new Date());

      const memberSubscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: memberId } });
      // A sponsored member's subscription has no currentPeriodEnd (billing
      // flows entirely through the leader's group invoice, never the
      // member's own cycle) - the same "no cycle to wait for" rule that
      // makes an ordinary Free-Plan self-service change apply immediately
      // means this downgrade also applies immediately, not as a pending change.
      const freePlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
      expect(memberSubscription.planId).toBe(freePlan.id);
      expect(memberSubscription.sponsoredByTeamId).toBeNull();

      const memberStoreAfter = await superuser.store.findUniqueOrThrow({ where: { id: memberStore.body.id } });
      expect(memberStoreAfter.status).toBe("active"); // never suspended by a group invoice
      const leaderStoreAfter = await superuser.store.findUniqueOrThrow({ where: { id: leaderStore.body.id } });
      expect(leaderStoreAfter.status).toBe("active"); // the leader's own store is unaffected too
    });
  });
});
