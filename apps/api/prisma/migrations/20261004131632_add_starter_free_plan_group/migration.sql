-- SRS §5.73/FR-73.2 (Global Launch Mandate) - a new PlanGroup value for the
-- permanent free template tier, coexisting alongside individual/team/supplier.
ALTER TYPE "PlanGroup" ADD VALUE 'starter_free';
