import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import { join } from "path";

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Writes one Traefik dynamic-config file per verified custom domain
 * (docs/tech-stack.md: Traefik owns ACME/TLS issuance natively - this
 * service's only job is telling Traefik a new hostname exists to route and
 * issue a certificate for; Traefik's file provider, configured with
 * `watch: true` in docker-compose.yml, picks up the change live). One file
 * per domain keeps add/remove trivial (write/delete a file, never parse or
 * merge a shared one).
 *
 * Cannot be verified against a real running Traefik in this sandbox (no
 * Docker daemon) - see the Module 3 verification report. The file-writing
 * logic itself (content correctness, safe filenames, add/remove) is real
 * and tested against the real filesystem.
 */
@Injectable()
export class TraefikDynamicConfigService {
  private readonly directory: string;

  constructor(config: ConfigService) {
    this.directory = config.getOrThrow<string>("TRAEFIK_DYNAMIC_CONFIG_DIR");
  }

  private filePath(domainName: string): string {
    if (!HOSTNAME_RE.test(domainName)) {
      throw new Error(`Refusing to write a Traefik config file for a non-hostname-shaped value: "${domainName}"`);
    }
    return join(this.directory, `${domainName}.yml`);
  }

  async writeRouterConfig(domainName: string): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    const routerKey = domainName.replace(/[^a-zA-Z0-9]/g, "-");
    const yaml = [
      "http:",
      "  routers:",
      `    domain-${routerKey}:`,
      `      rule: "Host(\`${domainName}\`)"`,
      // web@docker, not a bare "web" - Traefik v3 namespaces resources per
      // provider; this router is defined via the file provider but its
      // target service (the `web` container) was discovered via the docker
      // provider (docker-compose.yml's labels), so the cross-provider
      // reference must be explicit or it silently fails to resolve.
      "      service: web@docker",
      "      entryPoints:",
      "        - websecure",
      "      tls:",
      "        certResolver: letsencrypt",
      "",
    ].join("\n");
    await fs.writeFile(this.filePath(domainName), yaml, "utf8");
  }

  async removeRouterConfig(domainName: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(domainName));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
