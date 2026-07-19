import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { StoreThemeSettingsService } from "./store-theme-settings.service";

/**
 * SRS FR-1.6/§14.1 - the coded-theme escape hatch is gated by plan at the
 * app layer, resolved through the Settings Registry rather than a
 * hardcoded check. Covered here in isolation from Postgres/RLS (that part
 * is proven by theme-engine.e2e-spec.ts).
 */
describe("StoreThemeSettingsService", () => {
  const SELLER_ID = "11111111-1111-1111-1111-111111111111";
  const STORE_ID = "22222222-2222-2222-2222-222222222222";
  const THEME_ID = "33333333-3333-3333-3333-333333333333";

  function buildHarness(codedModeEnabled: boolean) {
    const existingRow = { storeId: STORE_ID, themeId: THEME_ID, settings: {}, customCode: null };
    const tx = {
      store: {
        findUnique: jest.fn().mockResolvedValue({ id: STORE_ID, onboardingThemeAckAt: null }),
        update: jest.fn().mockResolvedValue({ id: STORE_ID, onboardingThemeAckAt: new Date() }),
      },
      storeThemeSettings: {
        findUnique: jest.fn().mockResolvedValue(existingRow),
        update: jest.fn().mockImplementation(async ({ data }: { data: any }) => ({ ...existingRow, ...data })),
      },
      theme: { findFirst: jest.fn().mockResolvedValue({ id: THEME_ID, isActive: true }) },
    };
    const tenantPrisma = { run: jest.fn().mockImplementation(async (_sellerId: string, fn: any) => fn(tx)) };
    const settings = { resolve: jest.fn().mockResolvedValue(codedModeEnabled) };
    const subscriptions = { getPlanContext: jest.fn().mockResolvedValue({ sellerId: SELLER_ID, planId: undefined }) };
    const service = new StoreThemeSettingsService(tenantPrisma as any, settings as any, subscriptions as any);
    return { service, tx, settings };
  }

  it("allows a settings/theme update with no customCode regardless of coded-mode setting", async () => {
    const { service, settings } = buildHarness(false);
    const result = await service.update(SELLER_ID, STORE_ID, { settings: { colors: { primary: "#000" } } });
    expect(result.settings).toEqual({ colors: { primary: "#000" } });
    expect(settings.resolve).not.toHaveBeenCalled();
  });

  it("rejects setting customCode when theme.coded_mode_enabled resolves to false (v1.0 default)", async () => {
    const { service, settings } = buildHarness(false);
    await expect(service.update(SELLER_ID, STORE_ID, { customCode: "<script>alert(1)</script>" })).rejects.toThrow(
      ForbiddenException,
    );
    expect(settings.resolve).toHaveBeenCalledWith("theme.coded_mode_enabled", { sellerId: SELLER_ID, planId: undefined });
  });

  it("allows setting customCode when theme.coded_mode_enabled resolves to true", async () => {
    const { service } = buildHarness(true);
    const result = await service.update(SELLER_ID, STORE_ID, { customCode: "<div>custom</div>" });
    expect(result.customCode).toBe("<div>custom</div>");
  });

  it("throws NotFoundException when no store_theme_settings row exists yet", async () => {
    const { service, tx } = buildHarness(false);
    tx.storeThemeSettings.findUnique.mockResolvedValueOnce(null);
    await expect(service.update(SELLER_ID, STORE_ID, { settings: {} })).rejects.toThrow(NotFoundException);
  });
});
