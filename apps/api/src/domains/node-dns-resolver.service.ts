import { Injectable } from "@nestjs/common";
import { promises as dns } from "dns";
import { IDnsResolver } from "./dns-resolver.interface";

/** Real DNS queries via Node's resolver - no HTTP proxy involved, just the OS/container's configured DNS. */
@Injectable()
export class NodeDnsResolverService implements IDnsResolver {
  async resolveCname(hostname: string): Promise<string[]> {
    try {
      return await dns.resolveCname(hostname);
    } catch {
      return [];
    }
  }

  async resolve4(hostname: string): Promise<string[]> {
    try {
      return await dns.resolve4(hostname);
    } catch {
      return [];
    }
  }
}
