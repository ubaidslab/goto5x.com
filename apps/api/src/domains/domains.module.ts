import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { DomainVerificationService } from "./domain-verification.service";
import { DomainVerificationScheduler } from "./domain-verification.scheduler";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { DNS_RESOLVER } from "./dns-resolver.interface";
import { NodeDnsResolverService } from "./node-dns-resolver.service";
import { NodeTlsProberService } from "./node-tls-prober.service";
import { TLS_PROBER } from "./tls-prober.interface";
import { TraefikDynamicConfigService } from "./traefik-dynamic-config.service";

@Module({
  imports: [SettingsModule],
  controllers: [DomainsController],
  providers: [
    DomainsService,
    DomainVerificationService,
    DomainVerificationScheduler,
    TraefikDynamicConfigService,
    { provide: DNS_RESOLVER, useClass: NodeDnsResolverService },
    { provide: TLS_PROBER, useClass: NodeTlsProberService },
  ],
  exports: [DomainsService, DomainVerificationService],
})
export class DomainsModule {}
