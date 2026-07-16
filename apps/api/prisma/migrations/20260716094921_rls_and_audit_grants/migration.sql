-- Tenant isolation backstop (SRS §3.2) and audit-log immutability (SRS FR-8.9).
-- Cannot be expressed in schema.prisma's DSL, so it lives as raw SQL alongside
-- the generated migrations, in the same version-controlled history.

-- Sellers own stores; a seller's session must only ever see their own store
-- rows, enforced at the database level even if the application layer's
-- scoping middleware is ever bypassed by a bug.
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;

-- NOTE: a plain `current_setting('app.current_seller_id', true)::uuid` looked
-- correct but failed under real testing: once a custom (non-built-in) GUC has
-- been SET LOCAL at all during a session, Postgres does not fully "unset" it
-- back to NULL when that transaction ends - current_setting(..., true) then
-- returns an EMPTY STRING, which ''::uuid raises a hard error rather than
-- quietly evaluating to NULL/false. nullif(...,'') closes that gap so a
-- session with no context set behaves as "zero rows", not a 500 error - this
-- is the correct fail-closed behavior and was caught by the tenancy e2e test
-- that specifically checks the no-context-set case.
CREATE POLICY stores_seller_isolation ON stores
  USING (seller_id = nullif(current_setting('app.current_seller_id', true), '')::uuid);

-- app_admin has BYPASSRLS (granted in scripts/bootstrap-db.sql) and is
-- therefore unaffected by the policy above - this is intentional and the only
-- sanctioned way any code path sees another seller's store.

-- Immutable audit log (SRS FR-8.9): the application's runtime role may INSERT
-- and SELECT, but never UPDATE or DELETE - enforced by revoking the privilege
-- entirely, not by application-layer convention. app_admin is included in the
-- same restriction: BYPASSRLS bypasses row-level security, not table grants,
-- so even the admin-path role cannot rewrite history.
REVOKE UPDATE, DELETE ON admin_audit_logs FROM app_runtime, app_admin;

-- Same immutability guarantee for the per-user security-event trail
-- (SRS FR-25.3) - a password-reset/account-security event log should be no
-- easier to tamper with than the platform admin audit log.
REVOKE UPDATE, DELETE ON user_security_events FROM app_runtime, app_admin;