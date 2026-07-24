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
  await prisma.$disconnect();
  // eslint-disable-next-line no-console
  console.log("Baseline settings/plans/themes/agreement seeded.");
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
