-- Founder-directed scope addition - "Platform Merchant Connection": UZEYN
-- itself as the connected merchant, reusing Module 62's exact adapter
-- architecture. Global, admin-managed, no RLS (same shape as
-- external_api_clients/themes).
--
-- Note: `prisma migrate diff` spuriously proposes dropping
-- "idx_products_search"/"idx_products_tags", the search_vector column
-- default, and the og_image_media_id FKs, plus renaming several
-- pre-existing unique indexes - a known false positive with generated
-- tsvector columns + prisma's diff engine this repo has hit on every prior
-- migration. Stripped here, not applied - only the real change below.

CREATE TABLE "platform_gateway_connections" (
    "id" UUID NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "merchant_id" TEXT,
    "api_key_encrypted" TEXT,
    "api_secret_encrypted" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "verified_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "last_verified_at" TIMESTAMPTZ,
    "last_failed_at" TIMESTAMPTZ,
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_gateway_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_gateway_connections_provider_key" ON "platform_gateway_connections"("provider");
