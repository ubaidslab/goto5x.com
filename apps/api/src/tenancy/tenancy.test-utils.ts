import { INestApplication } from "@nestjs/common";
import request from "supertest";

/**
 * Reusable cross-tenant negative-test harness (SRS §3.2/§14.12 "release
 * gate"). Every later module that introduces its own tenant-scoped tables
 * should write its own version of this against its own endpoints - this one
 * proves the pattern on `stores` (Module 1); it is not meant to be the only
 * cross-tenant test the platform ever has.
 */
export async function assertCrossTenantAccessDenied(
  app: INestApplication,
  ownerToken: string,
  otherToken: string,
  resourcePath: (id: string) => string,
  createOwnResource: () => Promise<string>,
) {
  const resourceId = await createOwnResource();

  const ownerCanRead = await request(app.getHttpServer())
    .get(resourcePath(resourceId))
    .set("Authorization", `Bearer ${ownerToken}`);
  if (ownerCanRead.status !== 200) {
    throw new Error(`Owner could not read their own resource (status ${ownerCanRead.status}) - test setup is broken.`);
  }

  const otherCannotRead = await request(app.getHttpServer())
    .get(resourcePath(resourceId))
    .set("Authorization", `Bearer ${otherToken}`);

  if (otherCannotRead.status === 200) {
    throw new Error("Cross-tenant isolation FAILED: another seller's session could read this resource.");
  }
}
