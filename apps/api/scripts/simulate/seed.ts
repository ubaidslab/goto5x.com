import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";
import { ApiClient, Metrics, runWithConcurrency } from "./api-client";
import { RunManifest, SimulationSeller, writeManifest } from "./manifest";

const SHARED_PASSWORD = "sim-run-password-not-for-real-use";
// A 1x1 transparent PNG - just enough bytes to exercise the real media-upload
// path (Module 2) without shipping a real image asset in this repo.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function luhnCheckDigit(twelveDigits: string): number {
  let sum = 0;
  let shouldDouble = true; // check digit is appended at the end, so digit 12 (index 11) doubles first
  for (let i = twelveDigits.length - 1; i >= 0; i--) {
    let digit = Number(twelveDigits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return (10 - (sum % 10)) % 10;
}

/** A syntactically valid, Luhn-checksum-passing 13-digit CNIC, unique per index (SRS FR-30.1). */
function generateValidCnic(index: number): string {
  const twelve = `4210${String(index).padStart(8, "0")}`;
  return `${twelve}${luhnCheckDigit(twelve)}`;
}

interface SeedArgs {
  count: number;
  apiBaseUrl: string;
  concurrency: number;
}

function parseArgs(argv: string[]): SeedArgs {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    count: Number(get("--count", "100")),
    apiBaseUrl: get("--api-base-url", process.env.API_BASE_URL ?? "http://localhost:3000"),
    concurrency: Number(get("--concurrency", "10")),
  };
}

async function createAdminAndGetToken(client: ApiClient, admin: PrismaClient, runId: string): Promise<string> {
  const email = `sim-admin-${runId}@simulation.local`;
  const passwordHash = await bcrypt.hash(SHARED_PASSWORD, 10);
  const user = await admin.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
  await admin.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });

  const login = await client.post("admin:login", "/admin/auth/login", { email, password: SHARED_PASSWORD });
  const enroll = await client.post("admin:mfa-enroll", "/admin/auth/mfa/enroll", { preAuthToken: login.body.preAuthToken });
  const code = authenticator.generate(enroll.body.secret);
  const verify = await client.post("admin:mfa-verify", "/admin/auth/mfa/verify", {
    preAuthToken: login.body.preAuthToken,
    code,
  });
  if (!verify.body?.accessToken) {
    throw new Error(`Failed to bootstrap the simulation admin account: ${JSON.stringify(verify.body)}`);
  }
  return verify.body.accessToken as string;
}

async function seedOneSeller(
  client: ApiClient,
  adminToken: string,
  categoryId: string | undefined,
  runId: string,
  index: number,
): Promise<SimulationSeller> {
  const email = `sim+${runId}-${index}@simulation.local`;
  const lowBalanceScenario = index % 10 === 0; // ~10% - exercises the grace ladder (FR-6.25/6.26)
  const flaggedTitle = index % 12 === 0; // ~8% - exercises the Listing Moderation Engine (FR-27.x)

  await client.post("auth:signup", "/auth/signup", {
    agreementAccepted: true,
    email,
    password: SHARED_PASSWORD,
    businessName: `Simulation Store ${index}`,
  });
  const login = await client.post("auth:login", "/auth/login", { email, password: SHARED_PASSWORD });
  const sellerToken = login.body.accessToken as string;

  const slug = `sim-${runId}-store-${index}`.toLowerCase();
  const store = await client.post("dashboard:create-store", "/stores", { name: `Simulation Store ${index}`, slug }, sellerToken);
  const storeId = store.body.id as string;

  await client.patch("dashboard:payment-instructions", `/stores/${storeId}/payment-instructions`, { codEnabled: true }, sellerToken);
  await client.patch("dashboard:cnic", "/sellers/me/cnic", { cnic: generateValidCnic(index) }, sellerToken);

  const topUpAmount = lowBalanceScenario ? 500 : 3000;
  const topUp = await client.post("dashboard:wallet-topup-request", "/sellers/me/wallet/topup-requests", { amount: topUpAmount }, sellerToken);
  await client.post("admin:verify-topup", `/admin/wallet-topups/${topUp.body?.request?.id}/verify`, undefined, adminToken);

  await client.post("dashboard:publish-store", `/stores/${storeId}/publish`, undefined, sellerToken);

  const productCount = 3 + (index % 4); // 3-6, deterministic spread without extra RNG plumbing
  const products: { productId: string; variantIds: string[] }[] = [];
  const orderableProducts: { productId: string; variantIds: string[] }[] = [];
  for (let p = 0; p < productCount; p++) {
    const isFlagged = flaggedTitle && p === 0;
    const title = isFlagged ? `Simulation Replica Product ${index}-${p}` : `Simulation Product ${index}-${p}`;
    const product = await client.post(
      "dashboard:create-product",
      `/stores/${storeId}/products`,
      { title, status: "active", ...(categoryId && p % 3 !== 0 ? { categoryId } : {}) },
      sellerToken,
    );
    const productId = product.body.id as string;

    const thisProductVariants: string[] = [];
    const variantCount = 1 + (p % 3);
    for (let v = 0; v < variantCount; v++) {
      const variant = await client.post(
        "dashboard:create-variant",
        `/stores/${storeId}/products/${productId}/variants`,
        { sku: `SIM-${runId}-${index}-${p}-${v}`.toUpperCase(), price: 500 + p * 250 + v * 50, stockQuantity: 50 },
        sellerToken,
      );
      thisProductVariants.push(variant.body.id as string);
    }
    const entry = { productId, variantIds: thisProductVariants };
    products.push(entry);

    if (p % 3 === 0) {
      await client.uploadFile(
        "dashboard:upload-media",
        `/stores/${storeId}/media`,
        TINY_PNG,
        "sim-product.png",
        "image/png",
        { productId },
        sellerToken,
      );
    }

    // Every new seller's first `moderation.new_seller_probation_count`
    // products (10 by default, FR-27.3) are queued as "pending" regardless
    // of keyword content - a real product never becomes orderable until an
    // admin approves it. Approve here to mirror what actually happens to a
    // real seller's catalog soon after listing, EXCEPT for the one
    // deliberately flagged product per ~8% of sellers, which is left
    // pending on purpose to exercise the moderation queue (FR-27.x) - a
    // real, still-queued listing, not a simulation artifact.
    if (isFlagged) {
      continue;
    }
    await client.post("admin:approve-product", `/admin/moderation/queue/${productId}/approve`, undefined, adminToken);
    orderableProducts.push(entry);
  }

  await client.post("dashboard:create-collection", `/stores/${storeId}/collections`, { title: `Featured ${index}`, slug: `featured-${index}` }, sellerToken);

  const orderCount = 3 + (index % 5); // 3-7
  for (let o = 0; o < orderCount; o++) {
    const productIndex = o % orderableProducts.length;
    const { productId, variantIds: variantsForProduct } = orderableProducts[productIndex] ?? {};
    if (!productId || !variantsForProduct || variantsForProduct.length === 0) continue;
    const order = await client.post(
      "dashboard:create-order",
      `/stores/${storeId}/orders`,
      {
        buyerEmail: `sim-buyer-${runId}-${index}-${o}@simulation.local`,
        shippingAddress: { fullName: "Simulated Buyer", line1: "House 1, Street 1", city: "Karachi", country: "PK", phone: "03001234567" },
        items: [{ productId, variantId: variantsForProduct[0], quantity: 1 }],
      },
      sellerToken,
    );
    // Financial Truth Invariant (§3.12) - most orders get marked paid (accrues
    // commission for real, exercising the wallet debit path); a minority stay
    // pending, matching real-world "awaiting payment" spread.
    if (order.body?.id && o % 5 !== 4) {
      await client.post("dashboard:mark-order-paid", `/stores/${storeId}/orders/${order.body.id}/mark-as-paid`, undefined, sellerToken);
    }
  }

  return {
    userId: "", // filled in by caller from a DB lookup (cheaper as one batch query than one call per seller)
    sellerId: "",
    email,
    password: SHARED_PASSWORD,
    storeId,
    storeSlug: slug,
    lowBalanceScenario,
  };
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `run-${Date.now()}`;
  const metrics = new Metrics();
  const client = new ApiClient(args.apiBaseUrl, metrics);
  const admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_ADMIN_URL } } });

  console.log(`Seeding simulation run "${runId}" - ${args.count} sellers against ${args.apiBaseUrl} (concurrency ${args.concurrency})...`);
  const startedAt = Date.now();

  const adminToken = await createAdminAndGetToken(client, admin, runId);

  // One shared category (categories are a global, admin-managed taxonomy -
  // Module 2's CategoriesController.create() is AdminAuthGuard-only, not
  // seller-facing).
  const category = await client.post(
    "admin:create-category",
    "/categories",
    { name: `Simulation Category ${runId}`, slug: `sim-${runId}-category` },
    adminToken,
  );
  const categoryId = category.body?.id as string | undefined;

  const indices = Array.from({ length: args.count }, (_, i) => i + 1);
  const sellers: SimulationSeller[] = [];
  let completed = 0;

  await runWithConcurrency(indices, args.concurrency, async (index) => {
    try {
      const seller = await seedOneSeller(client, adminToken, categoryId, runId, index);
      sellers.push(seller);
    } catch (err) {
      console.error(`Failed to seed seller ${index}:`, err instanceof Error ? err.message : err);
    } finally {
      completed++;
      if (completed % 10 === 0 || completed === args.count) {
        console.log(`  ...${completed}/${args.count} sellers seeded`);
      }
    }
  });

  // Batch-fill userId/sellerId from the DB rather than an extra API round-trip per seller.
  const sellerRows = await admin.seller.findMany({
    where: { user: { email: { in: sellers.map((s) => s.email) } } },
    include: { user: true },
  });
  const byEmail = new Map(sellerRows.map((row) => [row.user.email, row]));
  for (const s of sellers) {
    const row = byEmail.get(s.email);
    if (row) {
      s.sellerId = row.id;
      s.userId = row.userId;
    }
  }

  const manifest: RunManifest = { runId, createdAt: new Date().toISOString(), sellers };
  writeManifest(manifest);

  const failed = args.count - sellers.length;
  const errorGroups = new Map<string, number>();
  for (const sample of metrics.samples) {
    if (!sample.ok) errorGroups.set(sample.errorType ?? "unknown", (errorGroups.get(sample.errorType ?? "unknown") ?? 0) + 1);
  }

  console.log("");
  console.log(`Seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
  console.log(`  Run ID:            ${runId}`);
  console.log(`  Sellers seeded:    ${sellers.length}/${args.count}${failed > 0 ? ` (${failed} FAILED - see errors above)` : ""}`);
  console.log(`  Total requests:    ${metrics.samples.length}`);
  if (errorGroups.size > 0) {
    console.log(`  Errors during seed:`);
    for (const [type, count] of errorGroups) console.log(`    ${type}: ${count}`);
  }
  console.log("");
  console.log(`Next: pnpm run simulate run --run ${runId} --duration 300`);
  console.log(`Then: pnpm run simulate report --run ${runId}`);
  console.log(`When done: pnpm run simulate teardown --run ${runId}`);

  await admin.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
