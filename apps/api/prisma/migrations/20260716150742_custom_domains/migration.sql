-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('pending', 'verified', 'failed');

-- CreateEnum
CREATE TYPE "DomainTlsStatus" AS ENUM ('pending', 'issued', 'error');

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "domain_name" TEXT NOT NULL,
    "verification_status" "DomainVerificationStatus" NOT NULL DEFAULT 'pending',
    "tls_status" "DomainTlsStatus" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domains_domain_name_key" ON "domains"("domain_name");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
