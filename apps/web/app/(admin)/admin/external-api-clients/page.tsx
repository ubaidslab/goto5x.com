"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";

type ClientType = "template_store" | "social_media_saas";

interface ExternalApiClient {
  id: string;
  clientType: ClientType;
  displayName: string;
  isEnabled: boolean;
  hasSigningSecret: boolean;
}

/**
 * SRS FR-8.14/§3.10 - admin can register, enable, disable, or rotate the
 * secret for either external-SaaS client without a deploy, mirroring the
 * Supplier Adapter registry. Bare functional view (no design pass yet),
 * same precedent as /admin/plans and /admin/sellers.
 */
export default function AdminExternalApiClientsPage() {
  const confirm = useConfirm();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [clients, setClients] = useState<ExternalApiClient[] | null>(null);
  const [clientType, setClientType] = useState<ClientType>("template_store");
  const [displayName, setDisplayName] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  function load() {
    fetch(`${apiBase}/admin/external-api-clients`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setClients)
      .catch(() => setClients([]));
  }

  useEffect(load, [apiBase]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRevealedSecret(null);
    const res = await fetch(`${apiBase}/admin/external-api-clients`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ clientType, displayName }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.message ?? "Couldn't create that client.");
      return;
    }
    setRevealedSecret(body.signingSecret);
    setDisplayName("");
    load();
  }

  async function toggle(id: string, isEnabled: boolean) {
    await fetch(`${apiBase}/admin/external-api-clients/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ isEnabled }),
    });
    load();
  }

  async function regenerateSecret(id: string, displayName: string) {
    const ok = await confirm({
      title: `Regenerate the signing secret for "${displayName}"?`,
      description: "The old secret stops working immediately - anything still using it (the external client's own integration) will fail until it's updated with the new one.",
      confirmLabel: "Regenerate secret",
      tone: "danger",
    });
    if (!ok) return;
    setRevealedSecret(null);
    const res = await fetch(`${apiBase}/admin/external-api-clients/${id}/regenerate-secret`, {
      method: "POST",
      headers: authHeaders(),
    });
    const body = await res.json();
    setRevealedSecret(body.signingSecret);
    load();
  }

  if (!clients) return <p>Loading...</p>;

  return (
    <main>
      <h1>External API Clients (bare view - no design pass yet)</h1>
      <p>Template Store and Social Media SaaS hooks (SRS §5.24). uzeyn.com never builds either external product - only this small, versioned API surface.</p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {revealedSecret && (
        <p>
          <strong>Signing secret (shown once - copy it now):</strong> <code>{revealedSecret}</code>
        </p>
      )}

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Display name</th>
            <th>Enabled</th>
            <th>Has secret</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>{c.clientType}</td>
              <td>{c.displayName}</td>
              <td>{c.isEnabled ? "yes" : "no"}</td>
              <td>{c.hasSigningSecret ? "yes" : "no"}</td>
              <td>
                <button onClick={() => toggle(c.id, !c.isEnabled)}>{c.isEnabled ? "Disable" : "Enable"}</button>{" "}
                <button onClick={() => regenerateSecret(c.id, c.displayName)}>Regenerate secret</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Register a client</h2>
      <form onSubmit={create}>
        <label>
          Type
          <select value={clientType} onChange={(e) => setClientType(e.target.value as ClientType)}>
            <option value="template_store">Template Store</option>
            <option value="social_media_saas">Social Media SaaS</option>
          </select>
        </label>
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <button type="submit">Register</button>
      </form>
    </main>
  );
}
