import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const SELLER_PASSWORD = "correct-horse-battery";

/**
 * FR-66.3 (Module 83, v0.56) - live chat widget, plan-gated RISE+FLY.
 * Covers: gate enforcement (GO-tier store rejects a new thread, RISE-tier
 * accepts), the buyer's unguessable-token-only access, seller inbox
 * list/detail/reply/close (RLS-scoped - another seller's store can't see
 * it), and the "seller is away" computation.
 */
describe("Live chat widget (e2e) - FR-66.3 (Module 83)", () => {
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

  async function signupLoginAndCreateStore(email: string, slug: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: SELLER_PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: SELLER_PASSWORD });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, hostname: `${slug}.uzeyn.com` };
  }

  async function upgradeToRise(sellerId: string) {
    const risePlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: risePlan.id } });
  }

  it("a GO-tier store rejects starting a new chat thread; a RISE-tier store accepts it", async () => {
    const { hostname, sellerId } = await signupLoginAndCreateStore("chat-go@example.com", "chat-go-store");

    const rejected = await request(app.getHttpServer()).post("/storefront/chat").send({ hostname, body: "Hi, is this in stock?" });
    expect(rejected.status).toBe(403);

    await upgradeToRise(sellerId);
    const accepted = await request(app.getHttpServer()).post("/storefront/chat").send({ hostname, body: "Hi, is this in stock?" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.accessToken).toBeTruthy();
    expect(accepted.body.threadId).toBeTruthy();
  });

  it("a buyer can poll and reply using only the accessToken, and the seller's reply shows up", async () => {
    const { token: sellerToken, storeId, hostname, sellerId } = await signupLoginAndCreateStore("chat-rise@example.com", "chat-rise-store");
    await upgradeToRise(sellerId);

    const started = await request(app.getHttpServer()).post("/storefront/chat").send({ hostname, body: "Hello?", buyerEmail: "buyer@example.com" });
    expect(started.status).toBe(200);
    const { accessToken, threadId } = started.body;

    const initialPoll = await request(app.getHttpServer()).get(`/storefront/chat/${accessToken}/messages`);
    expect(initialPoll.status).toBe(200);
    expect(initialPoll.body.messages).toHaveLength(1);
    expect(initialPoll.body.messages[0].authorType).toBe("buyer");
    expect(initialPoll.body.sellerAway).toBe(false);

    // FR-66.3's "seller is away" fallback: backdate the buyer's only
    // message past the default 5-minute threshold and confirm it flips.
    await superuser.buyerChatMessage.updateMany({
      where: { threadId },
      data: { createdAt: new Date(Date.now() - 10 * 60_000) },
    });
    const awayPoll = await request(app.getHttpServer()).get(`/storefront/chat/${accessToken}/messages`);
    expect(awayPoll.body.sellerAway).toBe(true);

    const sellerReply = await request(app.getHttpServer())
      .post(`/stores/${storeId}/buyer-chat/${threadId}/reply`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ body: "Yes, in stock!" });
    expect(sellerReply.status).toBe(201);

    const afterReply = await request(app.getHttpServer()).get(`/storefront/chat/${accessToken}/messages`);
    expect(afterReply.body.messages).toHaveLength(2);
    expect(afterReply.body.messages[1]).toMatchObject({ authorType: "seller", body: "Yes, in stock!" });
    expect(afterReply.body.sellerAway).toBe(false);

    const buyerReply = await request(app.getHttpServer()).post(`/storefront/chat/${accessToken}/messages`).send({ body: "Great, thanks!" });
    expect(buyerReply.status).toBe(200);
    expect(buyerReply.body.messages).toHaveLength(3);
  });

  it("an invalid/unknown accessToken is rejected, never leaking another thread's messages", async () => {
    const res = await request(app.getHttpServer()).get("/storefront/chat/not-a-real-token/messages");
    expect(res.status).toBe(404);
  });

  it("the seller inbox lists/shows only this store's own threads (RLS), and another seller cannot see them", async () => {
    const { token: sellerToken, storeId, hostname, sellerId } = await signupLoginAndCreateStore("chat-inbox@example.com", "chat-inbox-store");
    await upgradeToRise(sellerId);
    const started = await request(app.getHttpServer()).post("/storefront/chat").send({ hostname, body: "Question about sizing" });
    const { threadId } = started.body;

    const list = await request(app.getHttpServer()).get(`/stores/${storeId}/buyer-chat`).set("Authorization", `Bearer ${sellerToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].lastMessage.body).toBe("Question about sizing");

    const detail = await request(app.getHttpServer()).get(`/stores/${storeId}/buyer-chat/${threadId}`).set("Authorization", `Bearer ${sellerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.messages).toHaveLength(1);

    // Another seller, another store - must never see this thread.
    const other = await signupLoginAndCreateStore("chat-other-seller@example.com", "chat-other-store");
    const otherList = await request(app.getHttpServer()).get(`/stores/${other.storeId}/buyer-chat`).set("Authorization", `Bearer ${other.token}`);
    expect(otherList.status).toBe(200);
    expect(otherList.body).toHaveLength(0);
    const otherDetail = await request(app.getHttpServer())
      .get(`/stores/${other.storeId}/buyer-chat/${threadId}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(otherDetail.status).toBe(404);
  });

  it("closing a thread marks it closed", async () => {
    const { token: sellerToken, storeId, hostname, sellerId } = await signupLoginAndCreateStore("chat-close@example.com", "chat-close-store");
    await upgradeToRise(sellerId);
    const started = await request(app.getHttpServer()).post("/storefront/chat").send({ hostname, body: "Bye for now" });
    const { threadId, accessToken } = started.body;

    const close = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/buyer-chat/${threadId}/close`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(close.status).toBe(200);
    expect(close.body.status).toBe("closed");

    const poll = await request(app.getHttpServer()).get(`/storefront/chat/${accessToken}/messages`);
    expect(poll.body.status).toBe("closed");
  });
});
