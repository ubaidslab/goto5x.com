# goto5x.com — Final Tech Stack

**Optimized for:** solo-developer velocity, low VPS cost, long-term scalability, strong
ecosystem/community support (so answers and libraries exist when the solo founder+AI
team hits a wall).

---

## Core Principles

**One language, one runtime, everywhere possible.** For a solo founder, context-switching
between languages (e.g. Python backend + separate Node frontend tooling) is a hidden
tax. TypeScript end-to-end — backend, frontend, background workers, even scripts —
means one set of types, one package ecosystem, one debugging mental model.

**Self-host-first (SRS §9, binding, new in v0.4).** The default choice for any
infrastructure component is to self-host on the platform's own VPS. A recurring paid
third-party service is used only where self-hosting is genuinely infeasible —
concretely, that means **payment processing** (PCI/legal liability) and
**transactional email** (deliverability is a specialized, IP-reputation-dependent
problem). Everything else in the stack below — including object storage, which was
Cloudflare R2 in the v0.3 draft — defaults to something that runs on the VPS already
being paid for.

---

## Stack Table

| Layer | Choice | One-line justification |
|---|---|---|
| Language/runtime | **TypeScript / Node.js** | Single language across the whole system removes context-switching for a solo dev and has the largest hire-later talent pool |
| Backend framework | **NestJS** | Its module/DI structure maps directly onto the "modular monolith" architecture (§3.1 of SRS) — it enforces the module boundaries the architecture needs instead of relying on developer discipline |
| Frontend (storefront) | **Next.js (React)** | SSR/SSG gives the SEO and sub-2s load targets storefronts need, and static generation per store keeps VPS load low |
| Frontend (dashboards) | **Next.js (React), same repo/monorepo** | Reusing one frontend framework for storefront + seller dashboard + supplier portal + admin terminal avoids maintaining two frontend stacks solo |
| Database | **PostgreSQL** | Relational integrity for money-handling tables (orders/ledger) plus native Row-Level Security, which the SRS's tenant-isolation backstop depends on |
| ORM | **Prisma** | Fastest solo-dev velocity for type-safe queries + built-in migration tooling; Prisma's raw-query escape hatch is used for RLS-aware queries where needed |
| Connection pooling | **PgBouncer** | Required from Phase 1 per SRS §3.3 so adding app instances later never requires a disruptive pooling retrofit |
| Cache / queue | **Redis + BullMQ** | Redis is the one shared piece of state stateless app servers and workers both need (sessions, rate limits, job queue); BullMQ is the most mature Node job-queue library |
| Object storage | **Self-hosted MinIO** (S3-compatible container on the VPS) | Self-host-first principle — MinIO is free and runs on infrastructure already paid for; the S3-compatible API means a later migration to Cloudflare R2/AWS S3 (once volume justifies offloading storage ops) is a config change, not a rewrite |
| CDN | **Cloudflare (free tier)** | Fronts MinIO for bandwidth offload at zero cost; free tier covers Phase 1 traffic entirely |
| Reverse proxy / TLS | **Traefik** | Native Docker integration and **automatic per-domain TLS issuance**, which is a hard requirement once sellers start attaching arbitrary custom domains (SRS FR-11.2) — avoids hand-managing certbot per domain |
| Containerization | **Docker Compose (Phase 1) → lightweight orchestrator later** | Matches the SRS's explicit "no Kubernetes until justified" scaling stance |
| Background workers | **Node worker processes consuming BullMQ, stateless** | Same language/runtime as the API, horizontally scalable by just starting more instances |
| Auth | **Self-hosted (Lucia-style lightweight session/JWT library), not a per-MAU SaaS** | Auth0/Clerk-style pricing scales with buyer count, which is unbounded in a marketplace — a lightweight self-hosted module keeps unit economics sane and satisfies the future SSO hook (SRS §3.2a) |
| Payments | **Safepay SDK — v1.0's sole payment method**, Payment Adapter interface for future gateways | Fastest sole-proprietor-friendly onboarding in Pakistan (SRS §11); a prepaid-only launch keeps commission capture clean (SRS §5.6a). COD is deferred and gated (Settings Registry flag, per-seller), not part of the v1.0 integration; adapter pattern means adding PayFast/JazzCash/Stripe/COD later never touches ledger code |
| Payout disbursement | **Manual adapter (v1.0)**: admin batch screen + bank/Raast transfer, Disbursement Adapter interface for a future API-based adapter | No payout-automation SaaS is justified before v1.0 proves real payout volume (SRS §5.6b, §9) — the manual adapter costs nothing beyond admin time |
| Search | **PostgreSQL full-text search (Phase 1)** | No extra service to operate at MVP scale; revisit only when catalog size demands it |
| Email | **Transactional email API (e.g. Resend/SES-class provider)** | Deliverability is a solved problem elsewhere — not worth building |
| CI/CD | **GitHub Actions** | Free tier is generous at this project's size and lives next to the code already |
| Error tracking / monitoring | **Sentry (free tier) + Uptime Kuma (self-hosted)** | Catches production bugs early without recurring cost at Phase 1 scale |
| Infra-as-code | **Docker Compose files + a simple deploy script (Phase 1)** | Full IaC tooling (Terraform/Ansible) is justified starting Phase 2 when multiple VPS need coordinated provisioning |

---

## Why NestJS over a lighter framework (e.g. plain Express/Fastify)

A bare framework gives more raw speed to prototype but no enforced structure — on a
Shopify-class monolith built solo, that structure-less freedom becomes technical debt
fast (the exact "modular monolith drifts into a spaghetti ball" failure mode). NestJS's
module system, dependency injection, and guard/interceptor patterns are what make the
SRS's mandatory tenant-scoping middleware (§3.2) and RBAC guards enforceable
*everywhere* rather than hoped-for per file.

## Why Next.js for everything, including internal dashboards

The seller dashboard, supplier portal, and admin terminal don't need SSR/SEO, but
using Next.js for them anyway means one build system, one component library, one
deployment pipeline — a second frontend framework "because dashboards are different"
is exactly the kind of complexity a solo founder should refuse to pay for.

## Cost profile at Phase 1

Every choice above either has a generous free tier (Cloudflare CDN, GitHub Actions,
Sentry) or runs as a container on the single VPS already budgeted (Postgres, Redis,
MinIO, Traefik, workers) — the only recurring cash cost beyond the VPS itself at
Phase 1 is the payment gateway's per-transaction fee and the transactional email
provider (the two self-host-first exceptions), both of which scale with revenue, not
fixed cost. Payout disbursement in v1.0 is a manual admin process, not a paid
service, so it adds zero recurring cost either.
