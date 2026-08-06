import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminModule } from "../admin/admin.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { CrossSaasEligibilityController } from "./cross-saas-eligibility.controller";
import { ExternalApiClientsController } from "./external-api-clients.controller";
import { ExternalApiClientsService } from "./external-api-clients.service";
import { ExternalApiSignatureService } from "./external-api-signature.service";
import { MarketingHandoffController } from "./marketing-handoff.controller";
import { MarketingHandoffService } from "./marketing-handoff.service";
import { ProductFeedController } from "./product-feed.controller";
import { ProductFeedService } from "./product-feed.service";
import { SellerApiTokensController } from "./seller-api-tokens.controller";
import { SellerApiTokensService } from "./seller-api-tokens.service";
import { TemplateInstallController } from "./template-install.controller";
import { TemplateInstallService } from "./template-install.service";

/** Module 18 (SRS §5.24) - both external-SaaS hooks: uzeyn.com's own side only. */
@Module({
  imports: [AdminModule, PlansModule, SettingsModule, StorefrontModule, JwtModule.register({})],
  controllers: [
    ExternalApiClientsController,
    TemplateInstallController,
    ProductFeedController,
    SellerApiTokensController,
    CrossSaasEligibilityController,
    MarketingHandoffController,
  ],
  providers: [
    ExternalApiClientsService,
    ExternalApiSignatureService,
    TemplateInstallService,
    ProductFeedService,
    SellerApiTokensService,
    MarketingHandoffService,
    RateLimitService,
  ],
  exports: [ExternalApiClientsService],
})
export class ExternalApiModule {}
