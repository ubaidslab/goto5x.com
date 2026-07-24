# Launch Runbook

The ordered, end-to-end checklist for taking goto5x.com from a fresh VPS to
publicly serving real sellers. Built as part of Module 21 (Hardening &
Launch Readiness). This is the document to follow on launch day, top to
bottom — do not skip ahead. Every item is something a person (the founder)
actually does and checks off; a green CI run does not substitute for the
items in "Founder verification" or the simulation review, since those
prove things a test suite structurally cannot (real infra, real judgment
calls, real third-party services).

---

## 1. VPS provisioning

- [ ] Provision a VPS (sized per `docs/tech-stack.md`'s recommendation).
      Ubuntu 24.04 LTS or newer.
- [ ] Create a non-root deploy user with `sudo` and Docker-group membership;
      disable root SSH login and password auth (key-only).
- [ ] Install Docker Engine + Docker Compose plugin
      (`docker compose version` should print v2+).
- [ ] Open firewall ports: 80, 443 (Traefik), 22 (SSH). Nothing else needs
      to be internet-reachable — Postgres/Redis/MinIO stay on the compose
      network only (`docker-compose.yml` never publishes their ports).
- [ ] Set up unattended OS security updates (`unattended-upgrades` or
      equivalent).

## 2. DNS

- [ ] Point the platform's apex/`www` domain (or your chosen platform
      subdomain, e.g. `app.goto5x.com` / `api.goto5x.com` per
      `PLATFORM_HOSTNAMES`) at the VPS's IP with an A/AAAA record.
- [ ] Confirm propagation (`dig +short <domain>` from an external network)
      before proceeding — Traefik's Let's Encrypt HTTP-01 challenge will
      fail silently-but-repeatedly if DNS isn't live yet.
- [ ] Sellers' custom domains (FR-11.2) are a per-seller, ongoing
      operation, not a launch-day step — nothing to do here for those.

## 3. Secrets

- [ ] Generate every secret fresh for production — never reuse a value
      from `.env.example`, local dev, or this sandbox. Use
      `openssl rand -base64 32` (or `-hex 32` for `JWT_ACCESS_SECRET`,
      per README's "Secrets" table) for every generated-secret row in that
      table: `POSTGRES_SUPERUSER_PASSWORD`, the `app_runtime`/`app_admin`
      passwords, `JWT_ACCESS_SECRET`, `DRIVE_TOKEN_ENCRYPTION_KEY`,
      `EXTERNAL_API_SECRET_ENCRYPTION_KEY`.
- [ ] Store the resulting values in an encrypted secrets store, not just a
      plaintext `.env` sitting on the VPS's disk. Concretely, one of:
      - A password manager's CLI / secure-notes vault (1Password CLI,
        Bitwarden CLI) that the founder controls, with the VPS's `.env`
        generated from it at deploy time and never committed anywhere.
      - Your VPS provider's built-in secrets/env manager, if it offers
        one (e.g. a "Secrets" panel separate from the instance's disk
        image).
      - At minimum: `.env` on the VPS with `chmod 600`, owned by the
        deploy user only, on a disk that is itself encrypted at rest
        (most VPS providers offer this as a checkbox at provisioning
        time — confirm it's on).
      Whichever mechanism you pick, the two invariants that must hold are:
      real secrets are never in git (enforced today — `.env`/`.env.test`
      are gitignored, confirmed by `git status` never showing them
      tracked across this entire engagement) and never in a CI log
      (GitHub Actions' `${{ secrets.* }}` masking, N/A here since CI uses
      only locally-generated `ci-*` throwaway passwords per
      `.github/workflows/ci.yml` — nothing in CI is a real production
      credential).
- [ ] Fill in the third-party credential rows from their real dashboards:
      `EMAIL_PROVIDER_API_KEY`, `GOOGLE_DRIVE_CLIENT_ID`/`_SECRET`/
      `_REDIRECT_URI`, `PRINTIFY_API_KEY`, `ACME_EMAIL`. See README's
      "Secrets" table for exactly where each one comes from.
- [ ] Copy `.env.example` to `.env` on the VPS and fill in every value —
      `env.validation.ts` refuses to boot the API if any required var is
      missing, so this is fail-closed by construction, not something to
      manually double-check line by line.

## 4. Bring the stack up

- [ ] `docker compose up --build -d` from the repo root on the VPS.
      **This exact path has not been run in the sandbox this platform was
      built in** (no Docker daemon available there — see README's "Local
      setup (with Docker)" disclosure). Everything under README's
      "Local setup (without Docker)" section has been verified end-to-end
      instead. Treat this step as the first real test of the Dockerfiles/
      compose topology and watch `docker compose logs -f` closely.
- [ ] Confirm all 6 services report healthy: `docker compose ps`.
- [ ] Run `bootstrap-db.sql` once, as documented at the top of
      `apps/api/scripts/bootstrap-db.sql`, against the running `postgres`
      container, using the real production passwords from step 3:
      ```sh
      docker compose exec -T postgres psql -U "$POSTGRES_SUPERUSER" \
        -v runtime_password="$POSTGRES_RUNTIME_PASSWORD" \
        -v admin_password="$POSTGRES_ADMIN_PASSWORD" \
        -v dbname="$POSTGRES_DB" \
        -f - < apps/api/scripts/bootstrap-db.sql
      ```
- [ ] Apply migrations: `docker compose exec api pnpm prisma:migrate`
      (runs `prisma migrate deploy`, using the superuser connection wired
      into the API's Dockerfile entrypoint per `docs/architecture.md`).
- [ ] Create the MinIO bucket named by `MINIO_BUCKET` once
      (`docker compose exec minio mc mb local/$MINIO_BUCKET`, or the MinIO
      console at the container's console port) — the app does not
      auto-create it (README's "Secrets" table, `MINIO_BUCKET` row).
- [ ] **Required (Module 24 security fix, v0.28):** the bucket must NOT
      grant anonymous/public read on the `private-exports/` prefix —
      `SellerDataExport`'s products/orders/customers CSVs and summary PDF
      contain customer PII and are served exclusively through the
      authenticated `GET sellers/me/data-export/:id/download/:file`
      endpoint, never a direct object URL. Whatever policy makes other
      prefixes (`sellers/*/logo`, product images, etc.) publicly
      fetchable, explicitly exclude `private-exports/*` from it (e.g.
      `mc anonymous set download local/$MINIO_BUCKET` scoped per-prefix,
      not bucket-wide — check current MinIO docs for the exact per-prefix
      policy syntax). This is the one piece of the fix this repo's test
      suite cannot mechanically verify (the e2e test double doesn't model
      bucket ACLs) — confirm it directly after deploy: `curl` the
      constructed key path
      (`<MEDIA_PUBLIC_BASE_URL or MINIO_ENDPOINT/MINIO_BUCKET>/private-exports/sellers/<id>/exports/<file>`)
      with no auth header and confirm it is rejected, not served.
- [ ] Confirm Traefik issued real Let's Encrypt certificates: visit
      `https://<platform-domain>` in a browser and check the padlock/cert
      issuer, not just that the page loads.

## 5. Seed reference data

- [ ] The Settings Registry ships its own defaults via each module's
      `*.seed.ts`, applied automatically the first time the API boots
      against a fresh database (no separate seed command needed for
      those — same mechanism verified throughout local dev in this
      engagement). Confirm via the admin Settings screen
      (`/admin/settings`) that the expected keys are present, then move
      to step 10 to actually set their real launch values.
- [ ] The load/soak simulation's own seed data (step 8 below) is separate
      and optional — dummy sellers/stores for a stress test, not reference
      data the running platform needs.

## 6. Backup verification

- [ ] Set up a scheduled `pg_dump` (or `docker compose exec -T postgres
      pg_dump -U "$POSTGRES_SUPERUSER" "$POSTGRES_DB"`) to a location off
      the VPS itself (object storage, a second host) — a backup that
      lives only on the same disk as the database it backs up is not a
      backup. A simple daily cron calling `pg_dump | gzip > backup-$(date
      +%F).sql.gz` plus an `rclone`/`rsync` push off-box is sufficient for
      launch; a managed Postgres backup service is a fine later upgrade.
- [ ] **Actually test a restore once**, before launch, against a scratch
      database — `pg_dump` output that was never restored is unverified.
      `createdb goto5x_restore_test && gunzip -c backup-*.sql.gz | psql -d
      goto5x_restore_test`, then spot-check a few rows exist.
- [ ] Confirm MinIO's `minio_data` volume is included in your VPS
      provider's disk-snapshot schedule (or add MinIO to the same backup
      script via `mc mirror`) — product media lives there, not in
      Postgres.
- [ ] Note the restore procedure (which commands, in which order) in
      whatever runbook/notes system you keep for ongoing ops — this
      document covers the pre-launch check, not day-2 incident response.

## 7. Founder verification (things only a person can confirm)

These prove real, non-mocked behavior in each area a test suite has
disclosed as unverified against the genuine external system, plus the one
item that's inherently a subjective sign-off. Do all of these against the
real running production stack from step 4, not local dev.

- [ ] **Docker path smoke test** (README "Local setup (with Docker)").
      Already covered by step 4 above being the first real run of it —
      if step 4 succeeded end-to-end, this is satisfied.
- [ ] **Real MinIO upload** (README Module 2 disclosure). Upload a real
      product image through the dashboard's media screen and confirm it
      renders on the storefront — proves the S3-compatible client works
      against real MinIO, not just the `s3rver` test double the e2e suite
      uses.
- [ ] **Real Google Drive connect + import** (README Module 2 disclosure).
      Connect a real Google account via the dashboard's Drive-import flow
      and import at least one product — proves the OAuth flow and
      `DRIVE_TOKEN_ENCRYPTION_KEY`-encrypted refresh-token storage work
      against Google's real API, not the substituted test double.
- [ ] **Rich Results Test check** (FR-16.6's Product JSON-LD, SRS §14.16/
      §14.12). Publish a real product, then run its storefront URL through
      Google's Rich Results Test (`https://search.google.com/test/rich-results`)
      and confirm the `Product` structured data validates with no errors.
      Not previously an explicit README checklist item — added here since
      it needs a live, publicly-reachable URL that only exists post-launch
      infrastructure, unlike everything else in that list which could be
      checked in local dev.
- [ ] **Invoice template sign-off** (FR-19.2, §14.19 — carried over from
      README's own pre-launch list). Generate a real order's PDF invoice
      and give it the single explicit "clean and professional, not
      generic" sign-off §14.19 requires.
- [ ] **Full buyer journey click-through.** Starting from the storefront
      (not the dashboard): browse → product page → add to cart → checkout
      (email-first) → order confirmation → order-status page → download
      the invoice. Do this once per built-in theme if time allows, since
      each is a structurally distinct template (README Module 4
      disclosure).
- [ ] **Custom domain + TLS** (README Module 3 disclosure, needs step 2's
      real DNS). Attach one real domain you own to a test store, verify
      it, and confirm Traefik issues it a real cert and routes correctly —
      this is the one thing local dev genuinely cannot simulate at all
      (no Docker daemon, no real domain, in the sandbox this was built in).

## 8. Load/soak simulation run

- [ ] Review `apps/api/scripts/simulate/` — the seed+traffic+report+
      teardown CLI built in Module 21. Confirm you're running it against
      *this* production stack's API URL, not local dev, and that
      `NODE_ENV` on this box is **not** literally `production` unless you
      pass `--i-know` (the tool refuses to run otherwise — see
      `apps/api/scripts/simulate/safety.ts`). Running it against a live
      pre-launch environment with real (if empty) production data is the
      point; running it against a box already carrying real customer data
      is not — do this **before** opening signups to real sellers.
- [ ] Set `THROTTLE_LIMIT_PER_MINUTE` (in this box's `.env`, or exported in
      the shell that restarts the `api` container) to something like
      `100000` for the duration of this run, then restart the `api`
      service. The global per-IP rate limiter (`app.module.ts`'s
      `ThrottlerGuard`, 100 requests/60s by default) is correct and should
      stay in place for real traffic, but a load-generator machine driving
      hundreds of concurrent requests all counts as *one* IP to that
      limiter — found while smoke-testing this tool, where a small run
      still drowned in `http_429`s within seconds and never produced real
      latency data. Revert the env var and restart `api` again once the
      run (steps below) is done.
- [ ] Seed: `pnpm run simulate seed --count 100 --api-base-url
      https://<platform-api-domain>` (adjust `--count`/`--concurrency` to
      match how much load you want to generate; 100 is the default,
      matched to the founder's own real-hardware test plan).
- [ ] Run traffic: `pnpm run simulate run --run <runId> --duration 300
      --api-base-url https://<platform-api-domain>` (seconds; raise this
      for a longer soak).
- [ ] Review the printed report (also saved to
      `apps/api/scripts/simulate/reports/<runId>.txt`):
      - Error count by type — should be at or near zero; investigate
        anything beyond isolated transient timeouts.
      - p50/p95/p99 response times per endpoint group — sanity-check
        against what's acceptable for launch traffic volumes.
      - Slowest DB queries (via `pg_stat_statements`, if enabled — the
        report tells you how to enable it if not) — look for anything
        that should have an index and doesn't.
      - Invariant violations — **must be zero.** The report checks two
        concrete, SQL-provable invariants: no confirmed order has more
        than one commission-accrual ledger entry (a concurrent double-
        debit bug), and no order item or media asset ever references a
        product belonging to a *different* store (a live proof of tenant
        isolation under real concurrent load). Do not launch if either
        invariant check reports a violation — investigate and fix first.
- [ ] Teardown: `pnpm run simulate teardown --run <runId>` — removes
      everything the seed step created (scoped by the run's manifest, not
      a blind wipe; see the tool's own top-of-file comment for exactly
      what it does and does not delete). Confirm the admin Sellers list
      and Settings screen look clean afterward.
- [ ] Only after the report comes back clean and teardown has run,
      proceed to step 9.

## 9. Launch Settings values

Set these via the admin Settings screen (`/admin/settings`) — each has a
sensible development default seeded by its module's `*.seed.ts`, but none
of those defaults should be assumed correct for a real launch without an
explicit founder decision:

- [ ] `billing.commission_rate_percent` — the real launch commission rate.
- [ ] `billing.invoice_grace_period_days` — real grace period before an
      unpaid invoice trips the orders-paused ladder.
- [ ] `billing.wallet_low_balance_warning_threshold` /
      `billing.wallet_grace_days` — real wallet grace-ladder thresholds
      (FR-6.25/6.26).
- [ ] `billing.plan_fee_debit_check_hours` — real plan-fee debit cadence.
- [ ] `moderation.banned_keywords` / `moderation.restricted_keywords` —
      the real launch keyword lists for the Listing Moderation Engine
      (FR-27.x) — the seeded defaults are placeholders, not a vetted list.
- [ ] `plans.free_store_limit_per_identity`,
      `billing.launch_campaign_discount_percent` /
      `_expiry` / `_seller_limit` — real plan/pricing and any
      launch-promo campaign values.
- [ ] `auth.signup_rate_limit_per_hour` / `auth.login_rate_limit_per_hour`
      / `auth.password_reset_rate_limit_per_hour` — confirm these match
      the real expected launch traffic pattern (defaults were tuned for
      local dev/testing, not real user volumes).
- [ ] `lifecycle.dormant_warning_days` / `_suspend_days` / `_archive_days`
      / `_sweep_check_hours` — real dormant-store lifecycle thresholds.
- [ ] `catalog.product_limit` / `catalog.storage_quota_bytes` — real
      per-plan catalog limits, if different from the seeded defaults.
- [ ] `external_api.template_install_rate_limit_per_hour` /
      `external_api.product_feed_rate_limit_per_hour` — confirm against
      real expected external-SaaS integration traffic.

Once every item above is checked, the platform is ready to open signups to
real sellers.
