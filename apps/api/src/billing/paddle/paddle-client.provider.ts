import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

export const PADDLE_CLIENT = "PADDLE_CLIENT";

/**
 * D135/B3 (Paddle) - one platform-wide Paddle client, unlike B2's
 * per-store StripeGatewayAdapter.buildClient(apiKey). Constructed once
 * at boot from PADDLE_API_KEY/PADDLE_ENVIRONMENT - there is no per-row
 * "connection" here the way StorePaymentGatewayConnection gives Stripe
 * (see env.validation.ts's own comment on why this is an env var, not
 * the GatewayCredentialVaultService).
 *
 * Boot guard (founder's explicit "live keys never go live until I
 * approve", D134): refuses to construct a "production"-environment
 * client unless PADDLE_LIVE_APPROVED is also explicitly "true" - the
 * same shape as KmsModule's own production-safety boot guard, just
 * checked here instead of at module-selection time, since Paddle (unlike
 * KMS) has no separate "which implementation" axis to gate on.
 *
 * Returns `null` when PADDLE_API_KEY is unset (every environment before
 * the founder creates a Paddle account) - every consumer must handle a
 * null client by refusing the action with a clear message, never by
 * crashing the whole app at boot. This mirrors how every other
 * optional-until-configured integration in this codebase behaves
 * (EMAIL_PROVIDER=console, BACKUP_S3_* unset, etc.) rather than making
 * Paddle a hard boot dependency the way DATABASE_URL/REDIS_URL are.
 */
export const paddleClientProvider: Provider = {
  provide: PADDLE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Paddle | null => {
    const apiKey = config.get<string>("PADDLE_API_KEY");
    if (!apiKey) return null;

    const environment = config.get<string>("PADDLE_ENVIRONMENT") === "production" ? Environment.production : Environment.sandbox;
    if (environment === Environment.production && config.get<string>("PADDLE_LIVE_APPROVED") !== "true") {
      throw new Error(
        "PADDLE_ENVIRONMENT=production is set but PADDLE_LIVE_APPROVED!=true - refusing to boot with a live Paddle client until the founder explicitly approves (D134).",
      );
    }

    return new Paddle(apiKey, { environment });
  },
};
