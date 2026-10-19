import { PrismaClient } from "@prisma/client";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

/**
 * D135/B3 (Paddle) - idempotent setup, run once per Paddle account
 * (sandbox, then again whenever the founder sets up the live account
 * per D134): creates 3 Products (GO/RUN/RISE - D10's locked table;
 * FLY stays dormant, no Product/Price created for it) and 4 Prices
 * each (monthly/3mo/6mo/12mo), then records the 12 resulting Price IDs
 * in `plan_cycle_provider_prices` (already-existing, previously-unused
 * schema - see that model's own comment).
 *
 * Idempotent by design (safe to re-run): checks `custom_data.planSlug`+
 * `billingInterval` against Paddle's own product/price list before
 * creating anything, and the DB write is an upsert. Connects with its
 * own PrismaClient (DATABASE_ADMIN_URL), the same pattern
 * rotate-encryption-key.ts uses, since this runs standalone outside the
 * API process (a CI job, or the founder running it once by hand).
 *
 * Usage:
 *   PADDLE_API_KEY=... PADDLE_ENVIRONMENT=sandbox DATABASE_ADMIN_URL=... \
 *     npx ts-node scripts/setup-paddle-prices.ts
 */

const LOCKED_PRICES: Record<string, Record<string, number>> = {
  // D10's locked USD table - monthly/3mo/6mo/12mo.
  go: { monthly: 24, quarterly: 67, six_month: 127, yearly: 216 },
  run: { monthly: 49, quarterly: 137, six_month: 259, yearly: 441 },
  rise: { monthly: 119, quarterly: 332, six_month: 628, yearly: 1071 },
};

const BILLING_CYCLE: Record<string, { interval: "month" | "year"; frequency: number }> = {
  monthly: { interval: "month", frequency: 1 },
  quarterly: { interval: "month", frequency: 3 },
  six_month: { interval: "month", frequency: 6 },
  yearly: { interval: "year", frequency: 1 },
};

async function main() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_API_KEY must be set to run this script.");
  const environment = process.env.PADDLE_ENVIRONMENT === "production" ? Environment.production : Environment.sandbox;
  if (environment === Environment.production && process.env.PADDLE_LIVE_APPROVED !== "true") {
    throw new Error("PADDLE_ENVIRONMENT=production requires PADDLE_LIVE_APPROVED=true (D134) - refusing to create live Paddle catalog objects.");
  }
  const paddle = new Paddle(apiKey, { environment });
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_ADMIN_URL } } });

  try {
    for (const [slug, cycles] of Object.entries(LOCKED_PRICES)) {
      const plan = await prisma.plan.findFirst({ where: { planGroup: "individual", name: { equals: slug, mode: "insensitive" } } });
      if (!plan) {
        console.warn(`No Plan row found matching "${slug}" - skipping (check plans.seed.ts's naming).`);
        continue;
      }

      const existingProducts = await paddle.products.list({ perPage: 100 }).next();
      let product = existingProducts.find((p) => (p.customData as Record<string, unknown> | null)?.planSlug === slug);
      if (!product) {
        product = await paddle.products.create({ name: `goto5x ${slug.toUpperCase()}`, taxCategory: "saas", customData: { planSlug: slug } });
        console.log(`Created Paddle product for ${slug}: ${product.id}`);
      }

      for (const [billingInterval, amountUsd] of Object.entries(cycles)) {
        const existing = await prisma.planCycleProviderPrice.findUnique({
          where: { uniq_plan_cycle_provider_price: { planId: plan.id, billingInterval: billingInterval as never } },
        });
        if (existing?.paddlePriceId) {
          console.log(`Already recorded: ${slug}/${billingInterval} -> ${existing.paddlePriceId}`);
          continue;
        }

        const price = await paddle.prices.create({
          description: `goto5x ${slug.toUpperCase()} - ${billingInterval}`,
          productId: product.id,
          unitPrice: { amount: String(Math.round(amountUsd * 100)), currencyCode: "USD" },
          billingCycle: BILLING_CYCLE[billingInterval],
          customData: { planSlug: slug, billingInterval },
        });

        await prisma.planCycleProviderPrice.upsert({
          where: { uniq_plan_cycle_provider_price: { planId: plan.id, billingInterval: billingInterval as never } },
          create: { planId: plan.id, billingInterval: billingInterval as never, paddlePriceId: price.id },
          update: { paddlePriceId: price.id },
        });
        console.log(`Created Paddle price for ${slug}/${billingInterval} ($${amountUsd}): ${price.id}`);
      }
    }
    console.log("Paddle products/prices setup complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("setup-paddle-prices FAILED:", e);
  process.exit(1);
});
