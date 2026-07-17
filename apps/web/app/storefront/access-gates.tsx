"use client";

import { useState } from "react";
import { PublicStore } from "../../lib/storefront-api";
import { ResolvedThemeSettings } from "../../lib/theme-presets";
import { unlockStoreAction } from "./unlock-action";

// FR-16.5. Rendered instead of the normal storefront whenever
// store.accessMode !== "public" - see app/storefront/page.tsx.
export function ComingSoonPage({ store, theme }: { store: PublicStore; theme: ResolvedThemeSettings }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: theme.colors.background,
        color: theme.colors.text,
        padding: 24,
      }}
    >
      <h1 style={{ color: theme.colors.primary }}>{store.name}</h1>
      <p>We&apos;re getting things ready. Check back soon.</p>
    </main>
  );
}

export function PasswordGate({
  store,
  theme,
  hostname,
}: {
  store: PublicStore;
  theme: ResolvedThemeSettings;
  hostname: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await unlockStoreAction(hostname, store.id, password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? "Incorrect password.");
      return;
    }
    window.location.reload();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: theme.colors.background,
        color: theme.colors.text,
        padding: 24,
      }}
    >
      <h1 style={{ color: theme.colors.primary }}>{store.name}</h1>
      <p>This store is password-protected.</p>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, width: 280 }}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Checking…" : "Enter"}
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </form>
    </main>
  );
}
