import { PublicProduct } from "../../lib/storefront-api";
import { ResolvedThemeSettings } from "../../lib/theme-presets";

/**
 * FR-40.1/FR-40.2/FR-40.3 (SRS §5.40) - a supplier-sourced product shows a
 * "Ships in X-Y days"/"Delivers to: ..." line; a self-fulfilled product
 * (`supplierShipping` is null) renders nothing. Either line is independently
 * suppressed (not the whole badge) if its own data is incomplete, so one
 * missing field never hides information that IS present.
 */
export function resolveDeliveryBadge(supplierShipping: PublicProduct["supplierShipping"]) {
  if (!supplierShipping) return null;
  const { estimatedDeliveryMinDays, estimatedDeliveryMaxDays, supportedCountries } = supplierShipping;
  const hasWindow = Number.isFinite(estimatedDeliveryMinDays) && Number.isFinite(estimatedDeliveryMaxDays);
  const hasCountries = supportedCountries.length > 0;
  if (!hasWindow && !hasCountries) return null;
  return {
    deliveryText: hasWindow ? `Ships in ${estimatedDeliveryMinDays}-${estimatedDeliveryMaxDays} days` : null,
    countriesText: hasCountries ? `Delivers to: ${supportedCountries.join(", ")}` : null,
  };
}

export function DeliveryBadge({
  supplierShipping,
  theme,
}: {
  supplierShipping: PublicProduct["supplierShipping"];
  theme: ResolvedThemeSettings;
}) {
  const badge = resolveDeliveryBadge(supplierShipping);
  if (!badge) return null;
  return (
    <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.colors.text, opacity: 0.75 }}>
      {badge.deliveryText}
      {badge.deliveryText && badge.countriesText && " · "}
      {badge.countriesText}
    </p>
  );
}
