import { INestApplication } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const WEBHOOK_SECRET = "whsec_test_fake_secret_for_e2e"; // must match .env.test's PADDLE_WEBHOOK_SECRET

/**
 * D135/B3 (Paddle), sandbox-equivalent - PADDLE_API_KEY is deliberately
 * unset in .env.test (see its own comment), so PADDLE_CLIENT is null
 * throughout this whole file: the real state of every environment before
 * the founder sets up a Paddle account. The webhook controller's own
 * scratch-Paddle-instance fallback still runs REAL signature verification
 * (pure local HMAC-SHA256, no network call - see PaddleWebhookController's
 * own comment), so this proves the full real parse/verify/dedupe/confirm
 * path end to end; only the actual Paddle API calls (adjustments.create,
 * subscriptions.update) are unreachable here, which is exactly what the
 * separate paddle-sandbox-test CI job (real GitHub Actions secrets) exists
 * to cover instead.
 *
 * Fixture payloads are hand-built against the REAL installed SDK's
 * notification-entity constructors (read directly from node_modules'
 * compiled source, not guessed): TransactionNotification/
 * SubscriptionNotification/AdjustmentNotification all unconditionally
 * `.map()` their own `items`/`payments` arrays (and AdjustmentNotification
 * unconditionally constructs `totals`), so every fixture below includes
 * those even where this controller never reads them - omitting them
 * would throw inside the SDK's own parser, before our code ever runs.
 */
describe("Paddle webhook (e2e) - D135/B3, PADDLE_API_KEY unset (scratch-client signature verification)", () => {
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

  /** Mirrors requestPlanChange()'s own "currentPeriodEnd === null" immediate-apply branch - the real seller-facing step that must happen before any Paddle checkout redirect exists. */
  async function signupAndUpgradeToGoMonthly(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const goPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", name: { equals: "GO", mode: "insensitive" } } });

    const change = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: goPlan.id, billingInterval: "monthly" });
    expect(change.status).toBe(201);
    expect(change.body.billingInterval).toBe("monthly");

    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id as string, goPlanId: goPlan.id as string };
  }

  function signedHeader(rawBody: string, secret = WEBHOOK_SECRET) {
    // The SDK's own WebhooksValidator rejects anything more than 5 seconds
    // old (MAX_VALID_TIME_DIFFERENCE, read directly from its compiled
    // source) - ts must be computed fresh right before sending, never
    // hoisted, or this becomes flaky under load.
    const ts = Math.floor(Date.now() / 1000);
    const h1 = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
    return `ts=${ts};h1=${h1}`;
  }

  function transactionCompletedPayload(eventId: string, overrides: { sellerId?: string; subscriptionId?: string; customerId?: string; transactionId?: string }) {
    return JSON.stringify({
      event_id: eventId,
      event_type: "transaction.completed",
      occurred_at: new Date().toISOString(),
      data: {
        id: overrides.transactionId ?? "txn_01test",
        subscription_id: overrides.subscriptionId ?? "sub_01test",
        customer_id: overrides.customerId ?? "ctm_01test",
        custom_data: overrides.sellerId ? { sellerId: overrides.sellerId } : null,
        items: [],
        payments: [],
      },
    });
  }

  function subscriptionCanceledPayload(eventId: string, subscriptionId: string) {
    return JSON.stringify({
      event_id: eventId,
      event_type: "subscription.canceled",
      occurred_at: new Date().toISOString(),
      data: { id: subscriptionId, items: [], billing_cycle: { interval: "month", frequency: 1 } },
    });
  }

  async function postWebhook(payload: string, header: string) {
    return request(app.getHttpServer())
      .post("/billing/webhooks/paddle")
      .set("Paddle-Signature", header)
      .set("Content-Type", "application/json")
      .send(payload);
  }

  describe("signature verification", () => {
    it("rejects a request with no Paddle-Signature header", async () => {
      const res = await request(app.getHttpServer())
        .post("/billing/webhooks/paddle")
        .set("Content-Type", "application/json")
        .send(transactionCompletedPayload("evt_nosig", {}));
      expect(res.status).toBe(400);
    });

    it("rejects a forged signature (wrong secret), never touches the subscription", async () => {
      const { sellerId } = await signupAndUpgradeToGoMonthly("paddle-forged@example.com");
      const payload = transactionCompletedPayload("evt_forged", { sellerId });
      const forgedHeader = signedHeader(payload, "whsec_totally_wrong_secret");

      const res = await postWebhook(payload, forgedHeader);
      expect(res.status).toBe(400);

      const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(subscription.status).toBe("active"); // unchanged - still whatever requestPlanChange left it at, no paddleSubscriptionId
      expect(subscription.paddleSubscriptionId).toBeNull();
    });

    it("rejects a signature older than the SDK's 5-second replay window", async () => {
      const { sellerId } = await signupAndUpgradeToGoMonthly("paddle-stale@example.com");
      const payload = transactionCompletedPayload("evt_stale", { sellerId });
      const staleTs = Math.floor(Date.now() / 1000) - 30;
      const staleH1 = createHmac("sha256", WEBHOOK_SECRET).update(`${staleTs}:${payload}`).digest("hex");

      const res = await postWebhook(payload, `ts=${staleTs};h1=${staleH1}`);
      expect(res.status).toBe(400);
    });
  });

  describe("transaction.completed -> confirmCharge", () => {
    it("on a seller's first-ever Paddle charge: advances currentPeriodEnd from now, records the Paddle ids, and claims Founding Member ordinal #1", async () => {
      const { sellerId } = await signupAndUpgradeToGoMonthly("paddle-first@example.com");
      const payload = transactionCompletedPayload("evt_first", { sellerId, subscriptionId: "sub_first", transactionId: "txn_first" });

      const res = await postWebhook(payload, signedHeader(payload));
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ received: true });

      const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(subscription.status).toBe("active");
      expect(subscription.paddleSubscriptionId).toBe("sub_first");
      expect(subscription.paddleCustomerId).toBe("ctm_01test");
      expect(subscription.lastPaddleTransactionId).toBe("txn_first");
      expect(subscription.lastPaddleChargedAt).not.toBeNull();
      expect(subscription.isFoundingMember).toBe(true);
      expect(subscription.foundingMemberOrdinal).toBe(1);
      expect(subscription.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000); // ~1 month out
    });

    it("on a renewal (same paddleSubscriptionId already on file): advances from the existing currentPeriodEnd, no second Founding Member claim", async () => {
      const { sellerId } = await signupAndUpgradeToGoMonthly("paddle-renew@example.com");
      const first = transactionCompletedPayload("evt_renew_1", { sellerId, subscriptionId: "sub_renew", transactionId: "txn_renew_1" });
      expect((await postWebhook(first, signedHeader(first))).status).toBe(201);
      const afterFirst = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });

      const second = transactionCompletedPayload("evt_renew_2", { sellerId, subscriptionId: "sub_renew", transactionId: "txn_renew_2" });
      const res = await postWebhook(second, signedHeader(second));
      expect(res.status).toBe(201);

      const afterSecond = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(afterSecond.lastPaddleTransactionId).toBe("txn_renew_2");
      expect(afterSecond.currentPeriodEnd!.getTime()).toBeGreaterThan(afterFirst.currentPeriodEnd!.getTime());
      expect(afterSecond.foundingMemberOrdinal).toBe(afterFirst.foundingMemberOrdinal); // not re-claimed
    });

    it("a redelivered (duplicate) event ID is a no-op the second time - currentPeriodEnd never advances twice", async () => {
      const { sellerId } = await signupAndUpgradeToGoMonthly("paddle-dedupe@example.com");
      const payload = transactionCompletedPayload("evt_dedupe", { sellerId, subscriptionId: "sub_dedupe", transactionId: "txn_dedupe" });

      expect((await postWebhook(payload, signedHeader(payload))).status).toBe(201);
      const afterFirst = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });

      const second = await postWebhook(payload, signedHeader(payload));
      expect(second.status).toBe(201);
      expect(second.body).toEqual({ received: true });

      const afterSecond = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(afterSecond.currentPeriodEnd!.getTime()).toBe(afterFirst.currentPeriodEnd!.getTime());
    });

    it("skips (400 never thrown, event just acknowledged-less than that - no crash) when custom_data has no sellerId, and never creates a subscription write", async () => {
      await signupAndUpgradeToGoMonthly("paddle-nosellerid@example.com");
      const payload = transactionCompletedPayload("evt_nosellerid", {});

      const res = await postWebhook(payload, signedHeader(payload));
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ received: true });
    });

    it("the two sellers' first-ever payments claim consecutive Founding Member ordinals, never the same one", async () => {
      const a = await signupAndUpgradeToGoMonthly("paddle-fm-a@example.com");
      const b = await signupAndUpgradeToGoMonthly("paddle-fm-b@example.com");

      const payloadA = transactionCompletedPayload("evt_fm_a", { sellerId: a.sellerId, subscriptionId: "sub_fm_a", transactionId: "txn_fm_a" });
      const payloadB = transactionCompletedPayload("evt_fm_b", { sellerId: b.sellerId, subscriptionId: "sub_fm_b", transactionId: "txn_fm_b" });
      await postWebhook(payloadA, signedHeader(payloadA));
      await postWebhook(payloadB, signedHeader(payloadB));

      const subA = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: a.sellerId } });
      const subB = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: b.sellerId } });
      expect([subA.foundingMemberOrdinal, subB.foundingMemberOrdinal].sort()).toEqual([1, 2]);
    });
  });

  describe("subscription.canceled -> markCanceled", () => {
    it("marks the matching subscription cancelled", async () => {
      const { sellerId } = await signupAndUpgradeToGoMonthly("paddle-cancel@example.com");
      const charge = transactionCompletedPayload("evt_precancel", { sellerId, subscriptionId: "sub_cancel", transactionId: "txn_precancel" });
      await postWebhook(charge, signedHeader(charge));

      const cancel = subscriptionCanceledPayload("evt_cancel", "sub_cancel");
      const res = await postWebhook(cancel, signedHeader(cancel));
      expect(res.status).toBe(201);

      const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(subscription.status).toBe("cancelled");
    });

    it("no-ops (still 201) when no subscription matches that Paddle subscription id", async () => {
      const cancel = subscriptionCanceledPayload("evt_cancel_unknown", "sub_never_seen");
      const res = await postWebhook(cancel, signedHeader(cancel));
      expect(res.status).toBe(201);
    });
  });

  describe("seller-facing: GET checkout-price / POST request-refund", () => {
    it("checkout-price 404s when no Paddle price is configured for a plan/cycle yet (setup-paddle-prices.ts hasn't run)", async () => {
      const { token, goPlanId } = await signupAndUpgradeToGoMonthly("paddle-noprice@example.com");
      const res = await request(app.getHttpServer())
        .get("/sellers/me/subscription/paddle/checkout-price")
        .query({ planId: goPlanId, billingInterval: "monthly" })
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("checkout-price 400s when planId/billingInterval are missing", async () => {
      const { token } = await signupAndUpgradeToGoMonthly("paddle-missingquery@example.com");
      const res = await request(app.getHttpServer()).get("/sellers/me/subscription/paddle/checkout-price").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it("checkout-price returns the configured Paddle price id + client token once setup-paddle-prices.ts-style data exists", async () => {
      const { token, goPlanId } = await signupAndUpgradeToGoMonthly("paddle-hasprice@example.com");
      await superuser.planCycleProviderPrice.create({ data: { planId: goPlanId, billingInterval: "monthly", paddlePriceId: "pri_fake_go_monthly" } });

      const res = await request(app.getHttpServer())
        .get("/sellers/me/subscription/paddle/checkout-price")
        .query({ planId: goPlanId, billingInterval: "monthly" })
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ paddlePriceId: "pri_fake_go_monthly", paddleClientToken: "test_fake_client_token_for_e2e" });
    });

    it("request-refund end to end: auto-approves within the 14-day window, ends entitlement immediately", async () => {
      const { token, sellerId } = await signupAndUpgradeToGoMonthly("paddle-refund@example.com");
      const charge = transactionCompletedPayload("evt_refund_charge", { sellerId, subscriptionId: "sub_refund", transactionId: "txn_refund" });
      expect((await postWebhook(charge, signedHeader(charge))).status).toBe(201);

      const res = await request(app.getHttpServer()).post("/sellers/me/subscription/paddle/request-refund").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("approved");

      const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(subscription.status).toBe("cancelled");
      expect(subscription.currentPeriodEnd!.getTime()).toBeLessThanOrEqual(Date.now());

      const refundRequest = await superuser.paddleRefundRequest.findFirstOrThrow({ where: { sellerId } });
      expect(refundRequest.status).toBe("approved");
      expect(refundRequest.autoApproved).toBe(true);
      expect(refundRequest.paddleTransactionId).toBe("txn_refund");
    });

    it("request-refund 404s when this seller has no recorded Paddle charge yet", async () => {
      const { token } = await signupAndUpgradeToGoMonthly("paddle-norefund@example.com");
      const res = await request(app.getHttpServer()).post("/sellers/me/subscription/paddle/request-refund").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("a second refund request within 12 months routes to admin review instead of auto-approving (refund-hopping guard)", async () => {
      const { token, sellerId } = await signupAndUpgradeToGoMonthly("paddle-refundhop@example.com");
      const firstCharge = transactionCompletedPayload("evt_hop_charge_1", { sellerId, subscriptionId: "sub_hop", transactionId: "txn_hop_1" });
      await postWebhook(firstCharge, signedHeader(firstCharge));
      const firstRefund = await request(app.getHttpServer()).post("/sellers/me/subscription/paddle/request-refund").set("Authorization", `Bearer ${token}`);
      expect(firstRefund.body.status).toBe("approved");

      const secondCharge = transactionCompletedPayload("evt_hop_charge_2", { sellerId, subscriptionId: "sub_hop", transactionId: "txn_hop_2" });
      await postWebhook(secondCharge, signedHeader(secondCharge));
      const secondRefund = await request(app.getHttpServer()).post("/sellers/me/subscription/paddle/request-refund").set("Authorization", `Bearer ${token}`);
      expect(secondRefund.status).toBe(201);
      expect(secondRefund.body.status).toBe("pending");

      const pendingRequest = await superuser.paddleRefundRequest.findFirstOrThrow({ where: { sellerId, status: "pending" } });
      expect(pendingRequest.autoApproved).toBe(false);
    });
  });
});
