import { NavigationItem, PublicNavigation } from "../../lib/storefront-api";
import { ResolvedThemeSettings } from "../../lib/theme-presets";

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

export function SiteHeader({ navigation, theme }: { navigation: PublicNavigation; theme: ResolvedThemeSettings }) {
  if (navigation.header.length === 0) return null;
  return (
    <header style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", background: theme.colors.background }}>
      <NavItems items={navigation.header} theme={theme} />
    </header>
  );
}

export function SiteFooter({ navigation, theme }: { navigation: PublicNavigation; theme: ResolvedThemeSettings }) {
  if (navigation.footer.length === 0) return null;
  return (
    <footer style={{ padding: "24px", borderTop: "1px solid #e5e7eb", background: theme.colors.background }}>
      <NavItems items={navigation.footer} theme={theme} />
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
