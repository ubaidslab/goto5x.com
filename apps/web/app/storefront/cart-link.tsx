"use client";

import { useEffect, useState } from "react";
import { localCartCount, onLocalCartChange } from "../../lib/local-cart";
import { ResolvedThemeSettings } from "../../lib/theme-presets";

/**
 * FR-32.1 - reads `window.location.host` rather than taking a `hostname`
 * prop, so every existing SiteHeader call site is untouched; the count is
 * client-only state anyway (lib/local-cart.ts), so there's nothing for the
 * server render to know before hydration.
 */
export function CartLink({ theme }: { theme: ResolvedThemeSettings }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const hostname = window.location.host;
    const load = () => setCount(localCartCount(hostname));
    load();
    return onLocalCartChange(load);
  }, []);

  return (
    <a href="/cart" style={{ color: theme.colors.text, textDecoration: "none", fontWeight: 600 }}>
      Cart{count > 0 ? ` (${count})` : ""}
    </a>
  );
}
