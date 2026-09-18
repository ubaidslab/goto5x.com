-- CreateEnum
CREATE TYPE "DatabaseBackupStatus" AS ENUM ('success', 'failed', 'skipped_not_configured');

-- CreateTable
CREATE TABLE "database_backup_runs" (
    "id" UUID NOT NULL,
    "status" "DatabaseBackupStatus" NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ NOT NULL,
    "size_bytes" INTEGER,
    "object_key" TEXT,
    "error_message" TEXT,

    CONSTRAINT "database_backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "database_backup_runs_finished_at_idx" ON "database_backup_runs"("finished_at");
