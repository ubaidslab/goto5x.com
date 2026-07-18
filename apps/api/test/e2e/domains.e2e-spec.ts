import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import { join } from "path";
import request from "supertest";
import { DomainsService } from "../../src/domains/domains.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const TRAEFIK_DIR = process.env.TRAEFIK_DYNAMIC_CONFIG_DIR!;

describe("Custom domains & TLS (e2e) - SRS FR-11.1/FR-11.2, §14.11", () => {
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
    await fs.rm(TRAEFIK_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    await fs.rm(TRAEFIK_DIR, { recursive: true, force: true });
  });

  async function signupLoginAndCreateStore(email: string, slug: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string };
  }

  it("attaches a domain (pending/pending) and lists it", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("domain-owner@example.com", "domain-owner-store");

    const attach = await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains`)
      .set("Authorization", `Bearer ${token}`)
      .send({ domainName: "Shop.Example.com" }); // mixed case on purpose - proves normalization
    expect(attach.status).toBe(201);
    expect(attach.body.domainName).toBe("shop.example.com");
    expect(attach.body.verificationStatus).toBe("pending");
    expect(attach.body.tlsStatus).toBe("pending");

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/domains`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });

  it("rejects attaching one of the platform's own free subdomains as a custom domain (FR-11.1)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("domain-hijack@example.com", "domain-hijack-store");
    const res = await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains`)
      .set("Authorization", `Bearer ${token}`)
      .send({ domainName: "someone-else.goto5x.com" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed domain name before it reaches the database", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("domain-bad@example.com", "domain-bad-store");
    const res = await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains`)
      .set("Authorization", `Bearer ${token}`)
      .send({ domainName: "not a domain!!" });
    expect(res.status).toBe(400);
  });

  it("rejects attaching a domain that's already attached to any store, including another seller's", async () => {
    const a = await signupLoginAndCreateStore("domain-dupA@example.com", "domain-dup-store-a");
    const b = await signupLoginAndCreateStore("domain-dupB@example.com", "domain-dup-store-b");
    await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/domains`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ domainName: "contested.example.com" });

    const dup = await request(app.getHttpServer())
      .post(`/stores/${b.storeId}/domains`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ domainName: "contested.example.com" });
    expect(dup.status).toBe(409);
  });

  it(
    "real end-to-end: a domain whose real CNAME matches the configured target verifies, gets a real issued TLS cert, and a correct Traefik config file is written (FR-11.2)",
    async () => {
      const { token, storeId } = await signupLoginAndCreateStore("domain-real@example.com", "domain-real-store");
      // www.github.com genuinely CNAMEs to github.com right now - this is a
      // real, independently-verifiable public DNS fact, not a fixture.
      await superuser.settingsValue.create({
        data: { definitionKey: "domains.cname_target", scopeType: "global", scopeId: null, value: "github.com" },
      });

      const attach = await request(app.getHttpServer())
        .post(`/stores/${storeId}/domains`)
        .set("Authorization", `Bearer ${token}`)
        .send({ domainName: "www.github.com" });
      const domainId = attach.body.id;

      const verify = await request(app.getHttpServer())
        .post(`/stores/${storeId}/domains/${domainId}/verify`)
        .set("Authorization", `Bearer ${token}`);

      expect(verify.status).toBe(201);
      expect(verify.body.verificationStatus).toBe("verified");
      expect(verify.body.verifiedAt).not.toBeNull();
      // A real HTTPS handshake to www.github.com genuinely succeeds - this
      // is not simulated.
      expect(verify.body.tlsStatus).toBe("issued");

      const configContent = await fs.readFile(join(TRAEFIK_DIR, "www.github.com.yml"), "utf8");
      expect(configContent).toContain("rule: \"Host(`www.github.com`)\"");
      expect(configContent).toContain("certResolver: letsencrypt");
    },
  );

  it(
    "real end-to-end negative case: a real domain whose DNS does not point at goto5x fails verification",
    async () => {
      const { token, storeId } = await signupLoginAndCreateStore("domain-real-neg@example.com", "domain-real-neg-store");
      // dns.google's real A record (8.8.8.8) will never match this test
      // environment's default a_record_ip (127.0.0.1) - a genuine negative.
      const attach = await request(app.getHttpServer())
        .post(`/stores/${storeId}/domains`)
        .set("Authorization", `Bearer ${token}`)
        .send({ domainName: "dns.google" });
      const domainId = attach.body.id;

      const verify = await request(app.getHttpServer())
        .post(`/stores/${storeId}/domains/${domainId}/verify`)
        .set("Authorization", `Bearer ${token}`);

      expect(verify.body.verificationStatus).toBe("failed");
      expect(verify.body.tlsStatus).toBe("pending");
      await expect(fs.access(join(TRAEFIK_DIR, "dns.google.yml"))).rejects.toThrow();
    },
  );

  it("removing a domain deletes both the DB row and its Traefik config file", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("domain-remove@example.com", "domain-remove-store");
    await superuser.settingsValue.create({
      data: { definitionKey: "domains.cname_target", scopeType: "global", scopeId: null, value: "github.com" },
    });
    const attach = await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains`)
      .set("Authorization", `Bearer ${token}`)
      .send({ domainName: "www.github.com" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains/${attach.body.id}/verify`)
      .set("Authorization", `Bearer ${token}`);
    await fs.access(join(TRAEFIK_DIR, "www.github.com.yml")); // sanity: file really exists before removal

    const del = await request(app.getHttpServer())
      .delete(`/stores/${storeId}/domains/${attach.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);

    const dbRow = await superuser.domain.findUnique({ where: { id: attach.body.id } });
    expect(dbRow).toBeNull();
    await expect(fs.access(join(TRAEFIK_DIR, "www.github.com.yml"))).rejects.toThrow();
  });

  it("seller A cannot list, attach to, verify, or remove domains on seller B's store (cross-tenant)", async () => {
    const a = await signupLoginAndCreateStore("domainA@example.com", "domain-store-a");
    const b = await signupLoginAndCreateStore("domainB@example.com", "domain-store-b");
    const attachA = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/domains`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ domainName: "onlyA.example.com" });
    const domainId = attachA.body.id;

    const crossList = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/domains`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossList.status).toBe(404);

    const crossVerify = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/domains/${domainId}/verify`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossVerify.status).toBe(404);

    const crossRemove = await request(app.getHttpServer())
      .delete(`/stores/${a.storeId}/domains/${domainId}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossRemove.status).toBe(404);

    const unchanged = await superuser.domain.findUniqueOrThrow({ where: { id: domainId } });
    expect(unchanged.domainName).toBe("onlya.example.com");
  });

  it("a seller's OWN second store cannot reach the first store's domains via the URL (same-seller, cross-store boundary)", async () => {
    const { token, storeId: storeOneId } = await signupLoginAndCreateStore("domain-multi@example.com", "domain-multi-1");
    const storeTwo = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Second Store", slug: "domain-multi-2" });
    const attach = await request(app.getHttpServer())
      .post(`/stores/${storeOneId}/domains`)
      .set("Authorization", `Bearer ${token}`)
      .send({ domainName: "belongs-to-store-one.example.com" });

    const wrongStoreVerify = await request(app.getHttpServer())
      .post(`/stores/${storeTwo.body.id}/domains/${attach.body.id}/verify`)
      .set("Authorization", `Bearer ${token}`);
    expect(wrongStoreVerify.status).toBe(404);
  });

  it("RLS denies cross-tenant domain access at the database level, independent of the application layer", async () => {
    const sellerA = await superuser.seller.create({
      data: { businessName: "DB Domains A", user: { create: { email: "db-domains-a@example.com", roleFlags: ["seller"] } } },
    });
    const sellerB = await superuser.seller.create({
      data: { businessName: "DB Domains B", user: { create: { email: "db-domains-b@example.com", roleFlags: ["seller"] } } },
    });
    const storeA = await superuser.store.create({ data: { sellerId: sellerA.id, name: "DB Store A", slug: "db-domains-store-a" } });
    const storeB = await superuser.store.create({ data: { sellerId: sellerB.id, name: "DB Store B", slug: "db-domains-store-b" } });
    await superuser.domain.create({ data: { storeId: storeA.id, domainName: "db-domain-a.example.com" } });
    await superuser.domain.create({ data: { storeId: storeB.id, domainName: "db-domain-b.example.com" } });

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const asSellerA = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerA.id}'`);
      return tx.domain.findMany();
    });
    expect(asSellerA.map((d) => d.domainName)).toEqual(["db-domain-a.example.com"]);

    const noContext = await runtime.$transaction((tx) => tx.domain.findMany());
    expect(noContext).toEqual([]); // fail-closed, same as every other Module 2/3 tenant table

    await runtime.$disconnect();
  });

  it("resolveStoreIdByHostname (system-level lookup, used by a future storefront-routing module) resolves the correct store with no ambiguity", async () => {
    const a = await signupLoginAndCreateStore("domain-resolve-a@example.com", "domain-resolve-store-a");
    await superuser.settingsValue.create({
      data: { definitionKey: "domains.cname_target", scopeType: "global", scopeId: null, value: "irrelevant-for-this-test.example.com" },
    });
    await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/domains`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ domainName: "resolvable.example.com" });

    const domainsService = app.get(DomainsService);
    await expect(domainsService.resolveStoreIdByHostname("Resolvable.Example.com")).resolves.toBe(a.storeId);
    await expect(domainsService.resolveStoreIdByHostname("nobody-owns-this.example.com")).resolves.toBeNull();
  });

  describe("Domain upsell referral (FR-11.3, §14.11, v0.18)", () => {
    it("hides the referral block entirely when the enabled flag is off (default)", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("domain-referral-off@example.com", "domain-referral-off-store");

      const config = await request(app.getHttpServer())
        .get(`/stores/${storeId}/domains/config`)
        .set("Authorization", `Bearer ${token}`);
      expect(config.status).toBe(200);
      expect(config.body.referral).toBeNull();
    });

    it("renders the current Settings Registry URL/partner name once the enabled flag is turned on", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("domain-referral-on@example.com", "domain-referral-on-store");

      await superuser.settingsValue.create({
        data: { definitionKey: "domains.referral_enabled", scopeType: "global", scopeId: null, value: true },
      });
      await superuser.settingsValue.create({
        data: { definitionKey: "domains.referral_url", scopeType: "global", scopeId: null, value: "https://partner.example.com/buy" },
      });
      await superuser.settingsValue.create({
        data: { definitionKey: "domains.referral_partner_name", scopeType: "global", scopeId: null, value: "PartnerRegistrar" },
      });

      const config = await request(app.getHttpServer())
        .get(`/stores/${storeId}/domains/config`)
        .set("Authorization", `Bearer ${token}`);
      expect(config.body.referral).toEqual({
        url: "https://partner.example.com/buy",
        partnerName: "PartnerRegistrar",
      });
    });
  });
});
