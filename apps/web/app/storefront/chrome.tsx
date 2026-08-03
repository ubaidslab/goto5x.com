import { NavigationItem, PublicNavigation } from "../../lib/storefront-api";
import { ResolvedThemeSettings } from "../../lib/theme-presets";
import { CartLink } from "./cart-link";

// FR-16.3 - header/footer navigation, rendered from live data with no
// deploy needed for a seller's edit to take effect. `text_block`/
// `social_links` items (new in v0.6) are what make the footer support
// richer content than a plain link list - see
// docs/database-schema.md's store_navigation_menus note for the item shape.
function NavItemLink({ item, theme }: { item: NavigationItem; theme: ResolvedThemeSettings }) {
  const href =
    item.targetType === "external"
      ? item.url
      : item.targetType === "collection"
        ? `/collections/${item.targetId}`
        : item.targetType === "content_page"
          ? `/pages/${item.targetId}`
          : (item.url ?? "#");
  return (
    <a href={href} style={{ color: theme.colors.text, marginRight: 16 }}>
      {item.label}
    </a>
  );
}

function NavItems({ items, theme }: { items: NavigationItem[]; theme: ResolvedThemeSettings }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === "text_block") {
          return (
            <p key={index} style={{ margin: "8px 0" }}>
              {typeof item.body === "string" ? item.body : ""}
            </p>
          );
        }
        if (item.type === "social_links") {
          const platforms = (typeof item.body === "object" ? item.body : {}) as Record<string, string>;
          return (
            <span key={index}>
              {Object.entries(platforms)
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <a key={platform} href={url} style={{ color: theme.colors.text, marginRight: 12 }}>
                    {platform}
                  </a>
                ))}
            </span>
          );
        }
        return <NavItemLink key={index} item={item} theme={theme} />;
      })}
    </>
  );
}

/**
 * Module 23 (SRS §5.35, FR-35.4) - the buyer-facing trust mark, rendered
 * here so it appears on every storefront page AND at checkout (the
 * checkout page reuses this same SiteHeader) - one code change satisfies
 * both required render points.
 */
function VerifiedBadge() {
  return (
    <span
      title="This store has passed goto5x's Verified Store review."
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: "#0071e3",
        background: "rgba(0, 113, 227, 0.1)",
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      ✓ Verified
    </span>
  );
}

/**
 * FR-32.5 - the storefront's brand mark: the seller's uploaded logo when
 * set, otherwise the store name as a typographic mark. Never absent -
 * unlike the nav row below it (which can legitimately be empty), a buyer
 * must always be able to tell which store they're on.
 */
export function SiteHeader({
  navigation,
  theme,
  store,
}: {
  navigation: PublicNavigation;
  theme: ResolvedThemeSettings;
  store: { name: string; logoUrl: string | null; verified?: boolean };
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 24px",
        borderBottom: "1px solid #e5e7eb",
        background: theme.colors.background,
      }}
    >
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logoUrl} alt={store.name} style={{ height: 40, maxWidth: 200, objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.02em", color: theme.colors.text }}>
            {store.name}
          </span>
        )}
        {store.verified && <VerifiedBadge />}
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {navigation.header.length > 0 && <NavItems items={navigation.header} theme={theme} />}
        <CartLink theme={theme} />
      </div>
    </header>
  );
}

/**
 * Templates module (v0.31 design phase) - the "Powered by eyosto" mark.
 * Lives in this shared chrome component, never inside a template package,
 * so no template's own code can suppress it - `poweredByVisible` is
 * resolved server-side (StorefrontService.getStorePublic()) and is the
 * only thing that ever hides it.
 */
function PoweredByMark() {
  return (
    <p style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
      Powered by{" "}
      <a href="https://eyosto.com" style={{ color: "inherit" }}>
        eyosto
      </a>
    </p>
  );
}

export function SiteFooter({
  navigation,
  theme,
  poweredByVisible = true,
}: {
  navigation: PublicNavigation;
  theme: ResolvedThemeSettings;
  poweredByVisible?: boolean;
}) {
  if (navigation.footer.length === 0 && !poweredByVisible) return null;
  return (
    <footer style={{ padding: "24px", borderTop: "1px solid #e5e7eb", background: theme.colors.background }}>
      {navigation.footer.length > 0 && <NavItems items={navigation.footer} theme={theme} />}
      {poweredByVisible && <PoweredByMark />}
    </footer>
  );
}

// FR-16.4 - dismissible or persistent banner. v1.0 keeps it persistent only
// (no client-side dismiss-state persistence) - a bounded token set, same
// discipline as the customizer itself (SRS Risk Register #10).
export function AnnouncementBar({ theme }: { theme: ResolvedThemeSettings }) {
  if (!theme.announcementBar?.enabled || !theme.announcementBar.message) return null;
  return (
    <div style={{ background: theme.colors.primary, color: theme.colors.background, textAlign: "center", padding: 8 }}>
      {theme.announcementBar.message}
    </div>
  );
}

// FR-16.7 - a floating chat/order button, visible only when the seller has
// both enabled it and set a number.
export function WhatsappButton({ theme }: { theme: ResolvedThemeSettings }) {
  if (!theme.whatsapp?.enabled || !theme.whatsapp.phoneNumber) return null;
  const digits = theme.whatsapp.phoneNumber.replace(/[^\d]/g, "");
  return (
    <a
      href={`https://wa.me/${digits}`}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#25D366",
        color: "#fff",
        borderRadius: "50%",
        width: 56,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        fontSize: 24,
      }}
      aria-label="Chat on WhatsApp"
    >
      💬
    </a>
  );
}
