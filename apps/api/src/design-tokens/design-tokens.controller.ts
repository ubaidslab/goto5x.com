import { Controller, Get } from "@nestjs/common";
import { SettingsService } from "../settings-registry/settings.service";
import { DESIGN_TOKENS } from "./design-tokens.constants";

/**
 * Module 92 (SRS §5.68/FR-68.4) - public, unauthenticated, same
 * pre-auth shape as StorefrontDealsController: apps/web/app/layout.tsx
 * fetches this from every render (marketing, storefront, dashboard,
 * admin, login pages alike), so it must work for an anonymous visitor,
 * not just a logged-in session.
 *
 * Returns ONLY the tokens that currently have an active admin override -
 * the common case (nothing overridden yet) is an empty object, so the root
 * layout renders no extra <style> tag and nothing changes. Reuses
 * SettingsService.resolve()'s existing Redis cache rather than a new
 * caching layer - no extra infrastructure for this endpoint.
 */
@Controller("design-tokens")
export class DesignTokensController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getOverrides(): Promise<Record<string, string>> {
    const overrides: Record<string, string> = {};

    await Promise.all(
      DESIGN_TOKENS.map(async (token) => {
        const resolved = await this.settings.resolve<string>(token.key);
        if (resolved !== token.defaultValue) {
          overrides[token.cssVar] = resolved;
        }
      }),
    );

    return overrides;
  }
}
