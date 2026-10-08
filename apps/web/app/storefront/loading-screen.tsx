import { AnimatedElement } from "../../components/motion/AnimatedElement";
import { Reveal } from "../../components/motion/Reveal";
import { ResolvedThemeSettings } from "../../lib/theme-presets";

/**
 * SRS §5.74 FR-74.1/74.2 - the storefront's net-new branded loading state.
 * The seller's own logo gets FR-74.2's lowest-lift "animated logo" (the
 * existing D-Studio scale-in preset via AnimatedElement, not new Lottie/
 * video infrastructure); the UZEYN mark below it is gated by
 * `showManagedByUzeyn` (FR-74.3's individual-FLY-only rule, resolved
 * server-side as loadingScreenBrandingVisible - never
 * branding.powered_by_removable, which also resolves true for Team
 * Growth/Scale).
 */
export function BrandedLoadingScreen({
  storeName,
  logoUrl,
  theme,
  showManagedByUzeyn,
}: {
  storeName: string;
  logoUrl: string | null;
  theme: ResolvedThemeSettings;
  showManagedByUzeyn: boolean;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: theme.colors.background,
      }}
    >
      <AnimatedElement preset="scale-in" style={{ display: "flex", alignItems: "center" }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={storeName} style={{ height: 56, maxWidth: 240, objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.02em", color: theme.colors.text }}>
            {storeName}
          </span>
        )}
      </AnimatedElement>
      {showManagedByUzeyn && (
        <Reveal delay={0.15}>
          <p style={{ fontSize: 12, opacity: 0.6, color: theme.colors.text, margin: 0 }}>
            Managed by{" "}
            <a href="https://uzeyn.com" style={{ color: "inherit" }}>
              UZEYN
            </a>
          </p>
        </Reveal>
      )}
    </div>
  );
}
