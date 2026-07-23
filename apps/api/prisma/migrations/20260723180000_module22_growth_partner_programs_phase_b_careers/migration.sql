-- Module 22 Phase B (SRS §5.33, FR-33.8) - Careers.
--
-- Two lines this diff would otherwise include are stripped as a known
-- false positive (see docs/build-plan.md's Module 5/theme-engine note on
-- `idx_products_search`/`products.search_vector`): Prisma's migration
-- diffing cannot represent the `GENERATED ALWAYS AS ... STORED` column
-- correctly and proposes to drop/recreate its index and default on every
-- unrelated migration. Not touched here - same as every migration since.

-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('received', 'reviewing', 'interviewing', 'rejected', 'hired');

-- CreateTable
CREATE TABLE "job_postings" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "job_posting_id" UUID NOT NULL,
    "applicant_name" TEXT NOT NULL,
    "applicant_email" TEXT NOT NULL,
    "applicant_phone" TEXT,
    "cv_url" TEXT NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_job_applications_posting_status" ON "job_applications"("job_posting_id", "status");

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
