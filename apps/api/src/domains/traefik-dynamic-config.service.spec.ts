import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TraefikDynamicConfigService } from "./traefik-dynamic-config.service";

describe("TraefikDynamicConfigService (real filesystem)", () => {
  let dir: string;
  let service: TraefikDynamicConfigService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "uzeyn-traefik-test-"));
    const config = { getOrThrow: () => dir } as unknown as ConfigService;
    service = new TraefikDynamicConfigService(config);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a router config file with the domain's Host rule and the letsencrypt certResolver", async () => {
    await service.writeRouterConfig("shop.example.com");
    const content = await fs.readFile(join(dir, "shop.example.com.yml"), "utf8");
    expect(content).toContain("rule: \"Host(`shop.example.com`)\"");
    expect(content).toContain("service: web");
    expect(content).toContain("certResolver: letsencrypt");
  });

  it("removes a previously-written config file", async () => {
    await service.writeRouterConfig("shop.example.com");
    await service.removeRouterConfig("shop.example.com");
    await expect(fs.access(join(dir, "shop.example.com.yml"))).rejects.toThrow();
  });

  it("removing a file that was never written does not throw", async () => {
    await expect(service.removeRouterConfig("never-existed.example.com")).resolves.not.toThrow();
  });

  it("refuses to write a config for a value that isn't hostname-shaped (path-traversal guard)", async () => {
    await expect(service.writeRouterConfig("../../etc/passwd")).rejects.toThrow(/non-hostname-shaped/);
  });

  it("creates the target directory if it doesn't exist yet", async () => {
    const nested = join(dir, "does", "not", "exist", "yet");
    const config = { getOrThrow: () => nested } as unknown as ConfigService;
    const nestedService = new TraefikDynamicConfigService(config);
    await nestedService.writeRouterConfig("shop.example.com");
    const content = await fs.readFile(join(nested, "shop.example.com.yml"), "utf8");
    expect(content).toContain("shop.example.com");
  });
});
