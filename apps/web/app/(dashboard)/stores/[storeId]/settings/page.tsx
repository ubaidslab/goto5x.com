"use client";

import { useEffect, useState } from "react";

type AccessMode = "public" | "coming_soon" | "password_protected";

export default function StoreSettingsPage({ params }: { params: { storeId: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [accessMode, setAccessMode] = useState<AccessMode>("public");
  const [accessPassword, setAccessPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    fetch(`${apiBase}/stores/${params.storeId}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((s) => setAccessMode(s.accessMode))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, params.storeId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(`${apiBase}/stores/${params.storeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        accessMode,
        ...(accessPassword ? { accessPassword } : {}),
      }),
    });
    if (res.ok) {
      setAccessPassword("");
      setStatus("Saved.");
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  return (
    <main>
      <h1>Store settings</h1>
      <form onSubmit={onSave}>
        <fieldset>
          <legend>Storefront access (FR-16.5)</legend>
          <label>
            <input type="radio" checked={accessMode === "public"} onChange={() => setAccessMode("public")} />
            Public
          </label>
          <label>
            <input
              type="radio"
              checked={accessMode === "coming_soon"}
              onChange={() => setAccessMode("coming_soon")}
            />
            Coming soon
          </label>
          <label>
            <input
              type="radio"
              checked={accessMode === "password_protected"}
              onChange={() => setAccessMode("password_protected")}
            />
            Password-protected
          </label>
          {accessMode === "password_protected" && (
            <input
              type="password"
              placeholder="Set/change password"
              value={accessPassword}
              onChange={(e) => setAccessPassword(e.target.value)}
            />
          )}
        </fieldset>
        <button type="submit">Save</button>
        {status && <p>{status}</p>}
      </form>
    </main>
  );
}
