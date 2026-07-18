-- Module 14 follow-up: teams.plan_id (FR-7.18) - which Team tier a team
-- bills at, distinct from the leader's own individual-plan eligibility
-- gate (teams.leader_eligible). Safe as NOT NULL - no code has written to
-- `teams` yet (this table has zero rows in every environment).
--
-- Note: `prisma migrate diff` also proposed `DROP INDEX "idx_products_search"`
-- and `ALTER TABLE "products" ALTER COLUMN "search_vector" DROP DEFAULT` -
-- the same known Module 5 generated-column false-positive stripped from
-- every prior hand-written migration this session. Stripped here too.

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "plan_id" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
