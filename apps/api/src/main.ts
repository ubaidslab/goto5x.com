import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { seedDefaults } from "./bootstrap/seed-defaults";
import { PrismaAdminService } from "./prisma/prisma-admin.service";

async function bootstrap() {
  // rawBody: true (SRS §6.5) - the Template Install/License API and the
  // cross-SaaS eligibility endpoint verify an HMAC signature over the exact
  // request bytes; Nest still parses JSON normally for every other route,
  // this only additionally exposes `req.rawBody` for the handful of
  // controllers that need it (external-api/*.controller.ts).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Security-checklist audit finding: unlike worker.main.ts's own
  // SIGTERM/SIGINT handler (which closes every BullMQ worker cleanly),
  // this process had none at all - a `docker stop`/orchestrator SIGTERM
  // would hard-kill it mid-request instead of draining in-flight ones and
  // closing DB connections cleanly. enableShutdownHooks() wires Nest's own
  // lifecycle (onApplicationShutdown on every injectable, including
  // PrismaRuntimeService/PrismaAdminService's existing $disconnect hooks)
  // to these signals.
  app.enableShutdownHooks();
  // Autonomous punch-list fix (P1.4 input-validation sweep follow-up):
  // `whitelist: true` alone silently STRIPS any field a DTO doesn't declare
  // rather than rejecting the request - a client (or a stale/mistaken
  // frontend call) sending an extra field it thinks is being applied gets a
  // silent 200 with that field dropped, not an error telling it so.
  // `forbidNonWhitelisted: true` turns that same case into a real 400,
  // which is the actual input-validation posture FR-... intends.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Founder walkthrough finding (pre-Milestone-A): this previously only ran
  // via `test/e2e/setup.ts` (under the name `seedSettings`) or a manually-run
  // `scripts/dev-seed.ts` - a real deployment's first boot against a fresh
  // database never seeded a single Settings Registry definition, built-in
  // theme, or plan row, so almost every endpoint (store details, D-Studio,
  // SEO fields, ...) threw on its very first `SettingsService.resolve()`
  // call. Every individual seed function upserts with an empty `update: {}`
  // (see seed-defaults.ts's own comment), so this is safe to run on every
  // boot, including redeploys against a database that already has these
  // rows - it only ever creates what's missing.
  await seedDefaults(app.get(PrismaAdminService));
  // eslint-disable-next-line no-console
  console.log("Settings Registry defaults, themes, and plans confirmed seeded.");
  // Security-hardening fix (app-level audit): `true` trusts EVERY hop in a
  // client-supplied X-Forwarded-For unconditionally, so proxy-addr walks
  // all the way to its leftmost entry - which, since a well-behaved
  // reverse proxy like Traefik APPENDS its own observed peer rather than
  // overwriting the header, is entirely attacker-controlled. Confirmed
  // live: a client sending a fresh X-Forwarded-For value on every request
  // got a fresh `req.ip` every time, trivially bypassing EVERY per-IP rate
  // limit in the app (the global ThrottlerGuard and all 30+
  // RateLimitService.enforcePerHour call sites - signup, login, checkout,
  // gift-card purchase, etc.) with nothing more than a single spoofed
  // header, no botnet or proxy rotation required. In production (behind
  // exactly one Traefik hop, per docker-compose.yml), `1` trusts only that
  // one hop and correctly uses the LAST entry - the one Traefik itself
  // appended, not any earlier attacker-supplied value (verified directly
  // against this repo's pinned proxy-addr version, the library Express
  // uses for req.ip). Outside production there's no real reverse proxy in
  // front at all (dev is hit directly on its own port), so there's no real
  // attacker/trusted-hop boundary to enforce there - `true` is left
  // unchanged to avoid any behavior change to local dev. (The e2e test
  // suite is unaffected either way: it builds its Nest app directly via
  // Test.createTestingModule() in test/e2e/setup.ts, never through this
  // bootstrap() function, so this line never runs under Jest.)
  app.getHttpAdapter().getInstance().set("trust proxy", process.env.NODE_ENV === "production" ? 1 : true);

  // Production stays same-origin behind Traefik and needs no CORS at all.
  // Local dev (web on :3000, API on a different port) and future mobile apps
  // need an explicit, configurable allowlist - never a blanket wildcard.
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.length > 0) {
    app.enableCors({ origin: allowedOrigins, credentials: true });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`UZEYN API listening on port ${port}`);
}

bootstrap();
