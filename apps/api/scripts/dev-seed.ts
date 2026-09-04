import { PrismaClient } from "@prisma/client";
import { seedSettings } from "../test/e2e/setup";

/**
 * One-time local-dev convenience: seeds the Settings Registry defaults,
 * plan catalog, built-in themes, and current Seller Agreement version that
 * `scripts/simulate/seed.ts` (and any real signup) needs to already exist.
 * Safe to re-run — every `seed*` function upserts, never duplicates.
 */
(async () => {
  const prisma = new PrismaClient();
  await seedSettings(prisma);

  // Found while live-verifying FR-66.1 (Module 81) - `domains.
  // platform_root_domain` defaults to "uzeyn.com" (seedSettings() is
  // shared with the e2e suite, which never hits this through a real
  // browser Host header, so the gap was invisible there). Any browser
  // request to a simulated store's `<slug>.localhost:3001` storefront 404s
  // until this is overridden - not just for this verification, but for
  // the founder's own local run too (docs/founder-local-run.md), so it's
  // set here rather than left as a one-off manual fix.
  // A plain findFirst + create/update, not upsert's compound-key `where`
  // (Prisma's generated type for a compound unique index over a nullable
  // column like scopeId doesn't accept `null` there, even though the
  // column itself does) - same read-side pattern design-tokens-admin.
  // controller.ts already uses for this exact global/scopeId:null shape.
  const existingRootDomain = await prisma.settingsValue.findFirst({
    where: { definitionKey: "domains.platform_root_domain", scopeType: "global", scopeId: null },
  });
  if (existingRootDomain) {
    await prisma.settingsValue.update({ where: { id: existingRootDomain.id }, data: { value: "localhost:3001" } });
  } else {
    await prisma.settingsValue.create({
      data: { definitionKey: "domains.platform_root_domain", scopeType: "global", value: "localhost:3001" },
    });
  }

  await prisma.$disconnect();
  // eslint-disable-next-line no-console
  console.log("Baseline settings/plans/themes/agreement seeded (platform_root_domain set to localhost:3001 for local browser testing).");
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
