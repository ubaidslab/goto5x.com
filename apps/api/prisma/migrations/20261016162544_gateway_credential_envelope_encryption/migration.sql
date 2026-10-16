-- D117/D126 (founder decision) - envelope encryption for gateway secrets.
-- Nullable by design: an existing row's credentials stay readable under
-- the OLD scheme (a single static PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY)
-- until scripts/rewrap-gateway-credentials.ts backfills this column; a
-- fresh row written after this migration always gets one immediately
-- (GatewayCredentialVaultService.issueDataKey(), called from
-- PaymentGatewayService.connect()/PlatformGatewayService's own connect
-- path).
ALTER TABLE "store_payment_gateway_connections" ADD COLUMN "data_key_wrapped" TEXT;
ALTER TABLE "platform_gateway_connections" ADD COLUMN "data_key_wrapped" TEXT;
