import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody: true (SRS §6.5) - the Template Install/License API and the
  // cross-SaaS eligibility endpoint verify an HMAC signature over the exact
  // request bytes; Nest still parses JSON normally for every other route,
  // this only additionally exposes `req.rawBody` for the handful of
  // controllers that need it (external-api/*.controller.ts).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.getHttpAdapter().getInstance().set("trust proxy", true); // req.ip reflects the real client IP behind Traefik

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
