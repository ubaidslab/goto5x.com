# goto5x.com

Multi-tenant e-commerce platform. Full requirements live in `docs/SRS.md`
(approved v0.12); this README covers running the code.

**Status:** Modules 1–7 approved; Module 8 (Suppliers & Printify Adapter)
next. Platform Event Log amendment (SRS §3.11) built and backfilled. The
v0.10 amendment added two new modules to the sequence (Listing Moderation
Engine, Module 6; Seller Account Security: 2FA + Devices, Module 12, before
Payouts) and a binding Financial Truth Invariant NFR (§3.12). The v0.11
amendment slotted the moderation queue's bare functional admin page into
Module 17. The v0.12 amendment inserted a new **Seller Dashboard UI**
module (Module 10, after Orders/Cart/Checkout) plus a binding SIMPLICITY
INVARIANT NFR (§3.13) governing it and every seller-facing screen after —
see `docs/build-plan.md` for the full, current module sequence and
numbering.

---

## Architecture at a glance

- `apps/api` — NestJS modular monolith (see `docs/architecture.md`)
- `apps/web` — Next.js. Dashboard/auth pages are still bare functional (no
  design pass yet). The storefront (Module 4: home + product pages,
  multi-tenant Host-header routing, sitemap/robots) is real, functional, and
  componentized, but ships with three *structurally* distinct built-in
  themes rather than the bespoke, hand-designed premium visual bar the SRS
  ultimately calls for — that pass is blocked on branding assets not yet
  delivered (`docs/build-plan.md`'s Module 4 section has the full
  disclosure)
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
   Then seed Module 4's built-in theme catalog + its one settings key
   (`theme.coded_mode_enabled`) - every store-creation call fails closed if no
   theme has been seeded yet:
   ```sh
   npx ts-node src/theme-engine/themes.seed.ts
   ```
7. For real media features (Module 2), start a real MinIO instance (or the
   `docker-compose.yml` one) and create the bucket named by `MINIO_BUCKET`,
   plus a real Google Cloud OAuth Client ID for Drive import. Neither is
   required just to boot the API or run product/variant CRUD — only the
   media-upload and Google Drive endpoints touch them.
8. `TRAEFIK_DYNAMIC_CONFIG_DIR` (Module 3) can point at any writable local
   directory without Docker — the domain-attach/verify endpoints work
   end-to-end (DNS is checked for real) even without a running Traefik; only
   Traefik itself ever reads the files written there.
9. Run the API: `pnpm start:dev` (from `apps/api`), or `pnpm dev:api` from the repo root.
   Run the worker too if you want to see the domain-verification recheck job
   actually fire: `pnpm start:worker` (from `apps/api`).
10. `PLATFORM_HOSTNAMES` (Module 4, `apps/web`) is a comma-separated list of
    hostnames (including port, e.g. `localhost:3000`) that serve the
    platform's own site; any other incoming Host header is treated as a
    tenant storefront request. Defaults cover `localhost:3000`/
    `app.localhost(:3000)` — override it if you run `next dev`/`next start`
    on a different port, or requests to your own hostname will 404 as an
    unresolvable storefront instead of showing the platform site.

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
(running the domain-verification recheck job as of Module 3), behind Traefik
at `api.localhost` / `app.localhost`. You still need to run `bootstrap-db.sql`
once against the `postgres` container and apply migrations the first time —
the compose stack does not do either automatically in Module 1 (that's a
reasonable later addition once there's an actual deploy pipeline to wire it
into). You'll also need a real `ACME_EMAIL` set for the `traefik` service to
issue real certificates (Module 3) — Let's Encrypt requires a real address.

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

**Also unverified against the real thing (Module 3):** DNS resolution and
HTTPS/TLS connections to the live public internet **are** reachable in this
sandbox (confirmed directly, unlike Google's OAuth APIs), so
`NodeDnsResolverService` and `NodeTlsProberService` are tested against real,
well-known public hostnames — genuine DNS lookups and a genuine TLS
handshake, not mocks. What this sandbox cannot do is run a real Traefik (no
Docker daemon) or attach a domain the founder actually owns and controls the
DNS for. `TraefikDynamicConfigService`'s file output is verified for real
against the filesystem; whether a real running Traefik picks that file up
and successfully completes its own Let's Encrypt HTTP-01 challenge is a
`docker compose up --build` + a real owned domain's pre-launch smoke test,
same as the other two gaps above.

**Also unverified against the real thing (Module 4):** `apps/web` has no
automated test harness (no prior module needed one), so the storefront
rendering pages, `middleware.ts`'s Host-header routing, and `app/sitemap.ts`/
`app/robots.ts` were verified manually in this sandbox — a `next build`
production build, then a live `next dev`/`next start` boot hit with `curl -H
"Host: ..."` for a platform hostname, a tenant subdomain, and an
unresolvable hostname (all three behaved correctly: platform page, rendered
storefront, 404). The SEO fallback chain and hostname/canonical-domain
resolution the sitemap/robots data actually depends on **are** covered by
`apps/api`'s automated suite (`seo-fallback.util.spec.ts`,
`storefront.e2e-spec.ts`) — what's manual here is only the thin Next.js
passthrough over that already-tested data. Please click through the
storefront (home + a product page) and check `/sitemap.xml`/`/robots.txt`
against a real custom domain and the free subdomain as part of the same
pre-launch smoke test as the gaps above. Three *structurally* distinct
built-in themes ship in v1.0 (different default section order/color scheme)
rather than the bespoke, hand-designed premium visual bar the SRS ultimately
calls for — see `docs/build-plan.md`'s Module 4 section for why (branding
assets not yet delivered) and confirm this is an acceptable interim state
before launch.

**Also unverified against the real thing (Module 5):** same `apps/web`
testing boundary as Module 4 - the new collections/search pages, the
coming-soon/password gate, and the navigation/announcement-bar/WhatsApp/FAQ
chrome were verified via `next build` plus a live dev-server smoke test
(real signup → real store → real product → real collection, checked over
`curl -H "Host: ..."` including flipping `accessMode` to `coming_soon` and
confirming the gate page renders). The gate itself, full-text search, and
the "no password hash ever leaks" guarantee **are** covered by `apps/api`'s
automated e2e suite (`discovery.e2e-spec.ts`, `storefront-gating.e2e-spec.ts`)
- what's manual here is the Next.js rendering layer on top of that
already-tested API behavior. Please click through search, a collection
page, and the password-gate flow (set a password, confirm the wrong password
is rejected, confirm the right one unlocks) as part of the same pre-launch
smoke test as the gaps above.

**Module 6 (Listing Moderation Engine):** no `apps/web` changes at all -
the moderation queue is `apps/api`-only in this module (a REVIEWER admin
dashboard page is now explicitly slotted into Module 16, see the v0.11
amendment in `docs/build-plan.md`, rather than left implicit). Fully
covered by the automated e2e suite (`moderation.e2e-spec.ts`), including
the negative-access test proving a REVIEWER account cannot reach any admin
surface besides the queue.

**Module 7 (Shipping, Tax & Discounts):** also no `apps/web` changes - same
API-first precedent as Module 2's catalog/media (which never got a seller-
dashboard page either). Shipping/tax settings and discount-code CRUD are
fully covered by the automated e2e suite (`store-settings.e2e-spec.ts`),
including tenant isolation at both the app layer and the database (RLS).

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
   - Module 3's domain e2e specs make **real** DNS lookups and a **real**
     HTTPS/TLS handshake against well-known, stable public hostnames
     (`www.github.com`, `dns.google`) to prove `NodeDnsResolverService`/
     `NodeTlsProberService` genuinely work - no mocking, no test double. This
     needs outbound internet access from wherever you run the suite.
   - Module 4's `storefront.e2e-spec.ts` reuses the same real-domain
     verification flow to prove a *verified* custom domain becomes
     `canonicalHostname` while an unverified one does not resolve at all -
     no new external dependency beyond what Module 3 already needs.
2. Run:
   ```sh
   pnpm test:e2e
   ```

All 112 e2e tests + 70 unit tests pass as of Module 7 (see this module's
verification report for the full list), stable across 3 consecutive full
runs. `apps/web` has no automated test suite - see the Module 4/5
disclosures above for what was verified manually instead (Modules 6 and 7
shipped no apps/web changes at all - see their disclosures above).

---

## Secrets

`.env.example` (repo root) lists every required variable with a placeholder
and a comment on where it comes from. Never commit a real `.env` or
`.env.test` — both are gitignored. Rotating `JWT_ACCESS_SECRET` invalidates
every active session; there is no migration path for that, by design (a
compromised secret should kill every session, not quietly persist). Module 5
reuses this same secret to sign the storefront password-gate's short-lived
unlock token (FR-16.5) - rotating it also logs every gated storefront
visitor out, which is the same intended blast radius as a session.

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
| `TRAEFIK_DYNAMIC_CONFIG_DIR` | Any writable directory the API can write to and (in production) Traefik can read from - a shared Docker volume in `docker-compose.yml` |
| `ACME_EMAIL` | A real email address - Let's Encrypt requires one for expiry/problem notices. Read only by the `traefik` service, not the app |
| `PLATFORM_HOSTNAMES` (`apps/web`) | Comma-separated hostnames (with port, if non-default) that serve the platform's own site rather than a tenant storefront (Module 4). Not a secret - no default outside local dev needed since production always sets it to the platform's real domain(s) |

---

## Companion docs

`docs/SRS.md` (requirements), `docs/database-schema.md` (full schema),
`docs/architecture.md` (module/scaling diagrams), `docs/tech-stack.md`,
`docs/mvp-v1-cutlist.md`, `docs/build-plan.md` (module sequence + per-module
implementation plans), `docs/legal/` (ToS/Privacy/Refund drafts — **not**
reviewed by counsel, do not publish as-is).
