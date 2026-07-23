-- Run once per environment as the Postgres superuser, before the first Prisma
-- migration. Creates the two application roles referenced throughout
-- docs/database-schema.md and docs/SRS.md §3.2:
--   app_runtime - RLS-restricted, used for every tenant-facing request.
--   app_admin   - BYPASSRLS, used only on request paths already gated by
--                 AdminAuthGuard at the application layer.
--
-- Usage (values come from your .env - never commit real passwords):
--   psql "$SUPERUSER_CONNECTION_STRING" \
--     -v runtime_password="${POSTGRES_RUNTIME_PASSWORD}" \
--     -v admin_password="${POSTGRES_ADMIN_PASSWORD}" \
--     -v dbname="${POSTGRES_DB}" \
--     -f scripts/bootstrap-db.sql
--
-- IMPORTANT: do NOT wrap the -v values in their own single quotes (i.e. not
-- `-v runtime_password="'${POSTGRES_RUNTIME_PASSWORD}'"`) - the SQL below
-- already quotes the value via `:'runtime_password'`. Double-quoting it here
-- bakes literal quote characters into the stored password (caught by testing
-- this script end-to-end against a real Postgres instance before shipping it).
--
-- Note: role creation below uses the \gexec idiom (generate DDL as a query
-- result, then execute it) rather than a DO $$ ... $$ block, because psql's
-- variable substitution does not reach inside dollar-quoted string bodies -
-- also confirmed while testing this script against a real Postgres instance.

SELECT format('CREATE ROLE app_runtime LOGIN PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime')
\gexec

SELECT format('CREATE ROLE app_admin LOGIN PASSWORD %L BYPASSRLS', :'admin_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_admin')
\gexec

GRANT CONNECT ON DATABASE :dbname TO app_runtime, app_admin;
GRANT USAGE ON SCHEMA public TO app_runtime, app_admin;

-- Prisma migrations run as the superuser and create tables owned by it; both
-- application roles need DML rights on every table going forward. This
-- default-privilege rule means new tables created by later migrations (run by
-- the same superuser) automatically pick up the right grants without needing
-- this script re-run each time.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime, app_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime, app_admin;

-- ALTER DEFAULT PRIVILEGES only affects tables created AFTER this script
-- runs - it does NOT retroactively grant on tables that already exist. This
-- statement makes the script idempotent/safe to re-run at any point in the
-- database's lifecycle (e.g. after `prisma migrate reset`, which drops and
-- recreates the whole public schema and therefore wipes these grants) by
-- also granting on whatever tables currently exist. Caught by running this
-- script against a real Postgres instance after a migrate reset, not assumed.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime, app_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime, app_admin;

-- IMPORTANT: if you re-run this script after tables that must stay
-- insert-only (admin_audit_logs, user_security_events) already exist, the
-- blanket grant above re-adds UPDATE/DELETE to them too - immediately re-run
-- the REVOKE statements from the rls_and_audit_grants migration afterward
-- (see prisma/migrations/*_rls_and_audit_grants/migration.sql) to restore
-- immutability. Normal `prisma migrate deploy`/`migrate dev` workflows never
-- hit this - only the destructive `migrate reset` does.

-- Module 21's load/soak simulation teardown tool (apps/api/scripts/simulate/
-- teardown.ts) needs to temporarily suspend FK/trigger enforcement
-- (`SET LOCAL session_replication_role = replica`) to delete a scoped set of
-- rows without hand-maintaining a 30-table dependency order - this schema
-- has no ON DELETE CASCADE anywhere by design. Setting that GUC is
-- superuser-only by default in stock Postgres; `app_admin` only has
-- BYPASSRLS, not superuser, so without this grant the teardown tool fails
-- with "permission denied to set parameter" (caught by actually running the
-- teardown tool against a real Postgres instance, not assumed). PG15+
-- supports granting exactly this one parameter instead of a broader
-- privilege - found while making the teardown tool actually work end-to-end.
GRANT SET ON PARAMETER session_replication_role TO app_admin;
