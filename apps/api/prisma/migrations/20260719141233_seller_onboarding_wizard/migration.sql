-- Module 16 (Seller Onboarding Wizard, SRS §5.20/§5.25 FR-20.1/FR-25.5).
--
-- Note: `prisma migrate diff` spuriously proposes dropping "idx_products_search"
-- and the search_vector column default (a known false positive with generated
-- tsvector columns + prisma's diff engine, same issue every prior migration
-- in this repo has hit) - stripped, not applied.

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "onboarding_completed_at" TIMESTAMPTZ,
ADD COLUMN     "onboarding_domain_ack_at" TIMESTAMPTZ,
ADD COLUMN     "onboarding_theme_ack_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "seller_signup_waitlist" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_signup_waitlist_pkey" PRIMARY KEY ("id")
);

-- seller_signup_waitlist is global, unauthenticated-write data (mirrors
-- users/sellers) - deliberately NOT row-level-secured; nothing scopes it
-- to a seller/store, and nothing but the admin terminal will ever read it.
