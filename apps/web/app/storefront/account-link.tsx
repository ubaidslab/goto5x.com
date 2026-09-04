import { cookies } from "next/headers";
import { ResolvedThemeSettings } from "../../lib/theme-presets";

/**
 * FR-66.1 (Module 81) - a server component (unlike CartLink, which is
 * client-only) because the buyer session cookie is httpOnly and
 * deliberately unreadable from client JS - reading it here, server-side,
 * is exactly why it's an httpOnly cookie in the first place.
 */
export function AccountLink({ theme }: { theme: ResolvedThemeSettings }) {
  const loggedIn = Boolean(cookies().get("buyer_session")?.value);
  return (
    <a
      href={loggedIn ? "/account" : "/account/login"}
      style={{ color: theme.colors.text, textDecoration: "none", fontWeight: 600 }}
    >
      {loggedIn ? "Account" : "Sign in"}
    </a>
  );
}
