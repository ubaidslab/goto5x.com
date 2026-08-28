-- Known Prisma diff-engine false positive (documented in every prior
-- migration in this repo): a fresh `prisma migrate dev` diff against this
-- schema always includes spurious drops/recreates of the og_image_media_id
-- FKs, idx_products_search/idx_products_tags, the products.search_vector
-- default, an unrelated column type coercion, and RenameIndex noise for
-- indexes whose Prisma-inferred name differs from the DB's actual name.
-- None of that reflects an intended change here - only the two new tables
-- below are real.

-- CreateTable
CREATE TABLE "platform_gateway_consumed_references" (
    "id" UUID NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "reference" TEXT NOT NULL,
    "order_ref" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "consumed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_gateway_consumed_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_gateway_flagged_verifications" (
    "id" UUID NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "order_ref" TEXT NOT NULL,
    "reference" TEXT,
    "requested_amount" DECIMAL(12,2) NOT NULL,
    "gateway_amount" DECIMAL(12,2),
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "flagged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_admin_id" UUID,

    CONSTRAINT "platform_gateway_flagged_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_gateway_consumed_references_provider_reference_key" ON "platform_gateway_consumed_references"("provider", "reference");
