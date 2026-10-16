import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AwsKmsProvider } from "./aws-kms.provider";
import { KMS_PROVIDER, KmsProvider } from "./kms-provider.interface";
import { LocalDevKmsProvider } from "./local-dev-kms.provider";

/**
 * D117/D126 (founder decision) - selects the active KmsProvider from
 * KMS_PROVIDER_TYPE ("aws" | "local-dev"; defaults to "local-dev" so
 * every existing dev/CI environment keeps working unchanged without this
 * var set at all). Global, like every other cross-cutting infra module in
 * this codebase (RedisModule, IdempotencyModule).
 *
 * Deliberately constructs only the ONE selected provider class directly
 * (`new AwsKmsProvider(config)` / `new LocalDevKmsProvider(config)`)
 * rather than listing both as ordinary Nest providers injected into this
 * factory - Nest eagerly constructs every provider an `inject` array
 * names, which would make AwsKmsProvider's constructor run (and throw on
 * a missing AWS_KMS_KEY_ID) even in the common case where local-dev is
 * selected and no AWS config exists at all.
 *
 * Boot guard (D126, explicit founder instruction): refuses to boot at all
 * in production with LocalDevKmsProvider. This check runs here, at
 * module construction time, specifically so it fires during
 * NestFactory.create()/Test.createTestingModule().compile() itself -
 * before app.listen() is ever reached, not at the first request.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): KmsProvider => {
        const type = config.get<string>("KMS_PROVIDER_TYPE", "local-dev");
        const provider: KmsProvider = type === "aws" ? new AwsKmsProvider(config) : new LocalDevKmsProvider(config);
        if (config.get<string>("NODE_ENV") === "production" && !provider.isProductionSafe) {
          throw new Error(
            `Refusing to boot: KMS_PROVIDER_TYPE="${type}" (${provider.name}) is not production-safe, ` +
              "but NODE_ENV=production. Set KMS_PROVIDER_TYPE=aws with a real AWS_KMS_KEY_ID configured.",
          );
        }
        return provider;
      },
    },
  ],
  exports: [KMS_PROVIDER],
})
export class KmsModule {}
