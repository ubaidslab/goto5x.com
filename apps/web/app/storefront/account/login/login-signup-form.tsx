"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResolvedThemeSettings } from "../../../../lib/theme-presets";
import { buyerLoginAction, buyerSignupAction } from "../actions";

const inputStyle = { padding: 10, borderRadius: 8, border: "1px solid #d1d5db", width: "100%" } as const;
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 14 };

/** FR-66.1 (Module 81) - optional buyer account signup/login. Never blocks or replaces guest checkout. */
export function LoginSignupForm({ theme }: { theme: ResolvedThemeSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result =
      mode === "login" ? await buyerLoginAction(email, password) : await buyerSignupAction(email, password, displayName.trim() || undefined);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{mode === "login" ? "Sign in" : "Create an account"}</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Optional - you can always check out as a guest instead.{" "}
        <a href="/" style={{ color: theme.colors.primary }}>
          Continue browsing
        </a>
      </p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <label style={labelStyle}>
            Name (optional)
            <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
          </label>
        )}
        <label style={labelStyle}>
          Email address
          <input
            style={inputStyle}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label style={labelStyle}>
          Password
          <input
            style={inputStyle}
            type="password"
            required
            minLength={mode === "signup" ? 10 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: theme.colors.primary,
            color: "#fff",
            fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p style={{ fontSize: 13, marginTop: 16 }}>
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          style={{ color: theme.colors.primary, background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
        >
          {mode === "login" ? "Create an account" : "Sign in instead"}
        </button>
      </p>
    </div>
  );
}
