import { PrismaClient } from "@prisma/client";

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 0.2) - categories are
 * a deliberate, admin-curated global taxonomy (CategoriesController.create()
 * is AdminAuthGuard-only, not seller-facing - see that controller's own
 * doc comment; docs/SRS.md's storefront-navigation text also frames
 * categories as "admin-managed"). That design is not being changed here.
 * The actual bug: a fresh install shipped with ZERO categories and no
 * seller-reachable way to create one, so the product-creation category
 * dropdown was a dead end with nothing in it - reading as "category
 * creation is broken" even though the admin-side create form itself
 * works correctly. Seeding a real starter taxonomy closes that gap the
 * same way `themes.seed.ts`/`plans.seed.ts` already treat their own rows
 * as must-exist reference data, not optional demo content. Fixed IDs (not
 * random UUIDs) make this upsert idempotent/safe to re-run on every boot,
 * same discipline as `seedBuiltInThemes()`.
 */
const STARTER_CATEGORIES: { id: string; name: string; slug: string }[] = [
  { id: "c0000000-0000-4000-8000-000000000001", name: "Fashion & Apparel", slug: "fashion-apparel" },
  { id: "c0000000-0000-4000-8000-000000000002", name: "Beauty & Personal Care", slug: "beauty-personal-care" },
  { id: "c0000000-0000-4000-8000-000000000003", name: "Home & Kitchen", slug: "home-kitchen" },
  { id: "c0000000-0000-4000-8000-000000000004", name: "Electronics & Gadgets", slug: "electronics-gadgets" },
  { id: "c0000000-0000-4000-8000-000000000005", name: "Health & Wellness", slug: "health-wellness" },
  { id: "c0000000-0000-4000-8000-000000000006", name: "Sports & Outdoors", slug: "sports-outdoors" },
  { id: "c0000000-0000-4000-8000-000000000007", name: "Toys, Kids & Baby", slug: "toys-kids-baby" },
  { id: "c0000000-0000-4000-8000-000000000008", name: "Books & Stationery", slug: "books-stationery" },
  { id: "c0000000-0000-4000-8000-000000000009", name: "Jewelry & Accessories", slug: "jewelry-accessories" },
  { id: "c0000000-0000-4000-8000-00000000000a", name: "Food & Grocery", slug: "food-grocery" },
  { id: "c0000000-0000-4000-8000-00000000000b", name: "Pet Supplies", slug: "pet-supplies" },
  { id: "c0000000-0000-4000-8000-00000000000c", name: "Automotive", slug: "automotive" },
];

export async function seedDefaultCategories(prisma: PrismaClient): Promise<void> {
  for (const category of STARTER_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      create: category,
      update: {},
    });
  }
}
