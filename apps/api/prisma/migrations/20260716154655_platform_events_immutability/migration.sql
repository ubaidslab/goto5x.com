-- Platform Event Log (SRS §3.11/FR-26.x, v0.8): same insert-only-grant
-- immutability as admin_audit_logs/user_security_events
-- (prisma/migrations/20260716094921_rls_and_audit_grants/migration.sql).
-- Deliberately no RLS: this is a global table, and nothing reads it yet -
-- when a reader ships it will be admin-only (AdminAuthGuard), same access
-- shape as admin_audit_logs, not a seller-facing/tenant-scoped read.

REVOKE UPDATE, DELETE ON "platform_events" FROM app_runtime, app_admin;
