# goto5x.com

Multi-tenant e-commerce platform. Full requirements live in `docs/SRS.md`
(approved v0.7); this README covers running the code.

**Status:** Module 2 (Catalog & Media) — see `docs/build-plan.md` for the full
module sequence and what is/isn't in scope yet.

---

## Architecture at a glance

- `apps/api` — NestJS modular monolith (see `docs/architecture.md`)
- `apps/web` — Next.js (bare functional pages only in Module 1 — no design
  pass yet; that's a later module)
- PostgreSQL (via Prisma), Redis, MinIO, Traefik — see `docker-compose.yml`
  for the full production topology, mirrored locally

Two Postgres roles back every environment (`docs/build-plan.md`
"Foundational architecture decisions"):
- `app_runtime` — RLS-restricted, used for every tenant-facing request.
- `app_admin` — `BYPASSRLS`, used only behind `AdminAuthGuard`.

---

## Local setup (without Docker)

1. Install Postgres 16 and Redis locally, and start them.
2. Create the database and set a superuser password:
   ```sh
   createdb goto5x
   psql -c "ALTER USER postgres PASSWORD 'your-local-superuser-password';"
   ```
3. Bootstrap the two application roles (**do this once per fresh database**):
   ```sh
   cd apps/api
   PGPASSWORD=your-local-superuser-password psql -h localhost -U postgres -d goto5x \
     -v runtime_password="a-runtime-password" \
     -v admin_password="an-admin-password" \
     -v dbname="goto5x" \
     -f scripts/bootstrap-db.sql
   ```
   Read the comments at the top of `scripts/bootstrap-db.sql` before changing
   this invocation — the `-v` values must **not** be wrapped in their own
   quotes, or you'll bake literal quote characters into the stored password
   (a real bug caught while building this, not a hypothetical one).
4. Copy `.env.example` to `.env` in the repo root, and fill in real values —
   `DATABASE_URL` uses `app_runtime`, `DATABASE_ADMIN_URL` uses `app_admin`.
5. Install dependencies and run migrations:
   ```sh
   pnpm install
   cd apps/api
   # Point DATABASE_URL at the Postgres SUPERUSER for this one step only -
   # migrations create tables and must run as an owner/superuser, not as
   # app_runtime/app_admin, which only have DML rights (see bootstrap-db.sql).
   DATABASE_URL="postgresql://postgres:your-local-superuser-password@localhost:5432/goto5x" \
     npx prisma migrate deploy
   ```
6. Seed Module 1's real Settings Registry keys:
   ```sh
   npx ts-node src/settings-registry/settings.seed.ts
   ```
7. For real media features (Module 2), start a real MinIO instance (or the
   `docker-compose.yml` one) and create the bucket named by `MINIO_BUCKET`,
   plus a real Google Cloud OAuth Client ID for Drive import. Neither is
   required just to boot the API or run product/variant CRUD — only the
   media-upload and Google Drive endpoints touch them.
8. Run the API: `pnpm start:dev` (from `apps/api`), or `pnpm dev:api` from the repo root.

**Important — `prisma migrate reset`:** this command drops and recreates the
entire `public` schema, which wipes the schema-level grants
`bootstrap-db.sql` set up (they don't survive a dropped/recreated schema).
If you use `migrate reset` in development, **re-run `bootstrap-db.sql`
immediately afterward** (it's idempotent/safe to re-run at any time — see the
comments in the script). Caught by running the full test suite after a reset
and watching every query fail with "permission denied," not assumed to be fine.

## Local setup (with Docker)

```sh
docker compose up --build
```

This starts Postgres, Redis, MinIO, the API, the web app, and a worker
(currently idle — no job processors are registered until a later module),
behind Traefik at `api.localhost` / `app.localhost`. You still need to run
`bootstrap-db.sql` once against the `postgres` container and apply migrations
the first time — the compose stack does not do either automatically in
Module 1 (that's a reasonable Module-2-or-later addition once there's an
actual deploy pipeline to wire it into).

**Note:** the Dockerfiles in this repo have been written to the documented
architecture (multi-stage builds, root-context monorepo installs) but have
**not** been verified with a real `docker build`/`docker compose up` in this
environment — the sandbox this was built in has the Docker CLI but no daemon
available. Everything under "Local setup (without Docker)" above **has**
been run and verified end-to-end (migrations, RLS, the full test suite,
a production `nest build` + boot + `/health` check). Please do a
`docker compose up --build` smoke test before relying on the Docker path.

**Also unverified against the real thing (Module 2):** this sandbox has no
network egress to fetch a real MinIO binary, nor to reach Google's OAuth/
Drive APIs (only npm/pypi/crates/Anthropic domains are reachable through the
proxy). `ObjectStorageService` and the Google Drive integration are tested
against `s3rver` (a real, lightweight S3-API-compatible server) and a
substituted Drive-client test double respectively — see "Running tests"
below for exactly what that does and doesn't prove. Please do one real
upload and one real Google Drive connect+import against your own MinIO/
Google Cloud credentials before relying on either path in production.

---

## Running tests

Unit tests (no external services required):
```sh
cd apps/api
pnpm test
```

E2E tests need real Postgres + Redis (the whole point of Module 1's test
list is proving RLS/settings-registry/audit-log behavior against a real
database, not a mock):

1. Copy `apps/api/.env.test.example` to `apps/api/.env.test` and fill in your
   local `app_runtime`/`app_admin` passwords, plus `TEST_SUPERUSER_DATABASE_URL`
   (the Postgres superuser connection string).
   - The superuser connection is needed **only** for test setup/teardown: it's
     the one role that can `TRUNCATE admin_audit_logs`/`user_security_events`
     between tests, since those two tables intentionally revoke `UPDATE`/
     `DELETE` from both application roles for immutability (SRS FR-8.9). It is
     never the connection string the running application uses.
   - Module 2's media/Google Drive e2e specs don't need real MinIO or a real
     Google Cloud project: they start `s3rver` (a real, lightweight,
     S3-API-compatible local server - not a mock of the SDK) in-process, and
     override the Google Drive client with a test double for the one call
     that would otherwise need Google's network. See
     `test/e2e/s3-test-server.ts` and `test/e2e/google-drive.e2e-spec.ts`'s
     top comment for exactly what's real versus substituted.
2. Run:
   ```sh
   pnpm test:e2e
   ```

All 39 e2e tests + 29 unit tests pass as of this module (see the Module 2
verification report delivered alongside this build for the full list).

---

## Secrets

`.env.example` (repo root) lists every required variable with a placeholder
and a comment on where it comes from. Never commit a real `.env` or
`.env.test` — both are gitignored. Rotating `JWT_ACCESS_SECRET` invalidates
every active session; there is no migration path for that, by design (a
compromised secret should kill every session, not quietly persist).

| Variable | Where it comes from |
|---|---|
| `POSTGRES_*` | Set locally; on the VPS, generate with `openssl rand -base64 32` |
| `DATABASE_URL` / `DATABASE_ADMIN_URL` | Built from the `POSTGRES_*` values above |
| `REDIS_URL` | Local Redis, or the `redis` container's address |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Set locally; used as the app's S3 credentials against MinIO's root account (Module 2) |
| `MINIO_BUCKET` | Create this bucket once per environment - the app does not auto-create it |
| `MEDIA_PUBLIC_BASE_URL` | Optional; the CDN-fronted public URL for media. Leave unset locally to fall back to `MINIO_ENDPOINT`/`MINIO_BUCKET` directly |
| `EMAIL_PROVIDER_API_KEY` | The chosen provider's dashboard (docs/tech-stack.md) — leave `EMAIL_PROVIDER=console` for local dev, which prints emails to stdout instead of sending them |
| `ADMIN_MFA_ISSUER_NAME` | Whatever name should show up in an admin's authenticator app |
| `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET` / `GOOGLE_DRIVE_REDIRECT_URI` | A Google Cloud OAuth 2.0 Client ID (Drive API, read-only scope) |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` - encrypts a seller's stored Drive refresh token at rest (SRS FR-9.1/§6.5); the short-lived access token is never persisted to Postgres at all, so there is no equivalent key needed for it |

---

## Companion docs

`docs/SRS.md` (requirements), `docs/database-schema.md` (full schema),
`docs/architecture.md` (module/scaling diagrams), `docs/tech-stack.md`,
`docs/mvp-v1-cutlist.md`, `docs/build-plan.md` (module sequence + per-module
implementation plans), `docs/legal/` (ToS/Privacy/Refund drafts — **not**
reviewed by counsel, do not publish as-is).
