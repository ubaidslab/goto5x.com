"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface SupplierAdapter {
  id: string;
  adapterType: string;
  displayName: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Module 25 P1 (FR-4.9) - register, enable/disable, or reconfigure a
 * supplier adapter without a deploy. API-only before this module. Bare
 * functional view (no design pass yet).
 */
export default function AdminSupplierAdaptersPage() {
  const [adapters, setAdapters] = useState<SupplierAdapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adapterType, setAdapterType] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});

  function load() {
    adminApi
      .get<SupplierAdapter[]>("/admin/supplier-adapters")
      .then((list) => {
        setAdapters(list);
        setConfigDrafts(Object.fromEntries(list.map((a) => [a.id, JSON.stringify(a.config, null, 2)])));
      })
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load supplier adapters."));
  }

  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminApi.post("/admin/supplier-adapters", { adapterType, displayName });
      setAdapterType("");
      setDisplayName("");
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't create this adapter.");
    }
  }

  async function toggleEnabled(adapter: SupplierAdapter) {
    await adminApi.patch(`/admin/supplier-adapters/${adapter.id}`, { isEnabled: !adapter.isEnabled });
    load();
  }

  async function saveConfig(adapterId: string) {
    let config: unknown;
    try {
      config = JSON.parse(configDrafts[adapterId]);
    } catch {
      alert("Config must be valid JSON.");
      return;
    }
    try {
      await adminApi.patch(`/admin/supplier-adapters/${adapterId}`, { config });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't save this config.");
    }
  }

  if (error) return <main>{error}</main>;
  if (!adapters) return <main>Loading...</main>;

  return (
    <main>
      <h1>Supplier adapters (bare view - no design pass yet)</h1>
      <p>Register a new supplier integration, enable/disable one, or edit its config JSON - all without a deploy.</p>

      {adapters.map((a) => (
        <div key={a.id} style={{ marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid #ccc" }}>
          <p>
            <strong>{a.displayName}</strong> ({a.adapterType}) - {a.isEnabled ? "enabled" : "disabled"}{" "}
            <button onClick={() => toggleEnabled(a)}>{a.isEnabled ? "Disable" : "Enable"}</button>
          </p>
          <p>
            <textarea
              rows={5}
              cols={60}
              value={configDrafts[a.id] ?? ""}
              onChange={(e) => setConfigDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
            />
          </p>
          <button onClick={() => saveConfig(a.id)}>Save config</button>
        </div>
      ))}

      <h2>Register a new adapter</h2>
      <form onSubmit={create}>
        <p>
          <label>
            Adapter type (internal key): <input value={adapterType} onChange={(e) => setAdapterType(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Display name: <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
        </p>
        <button type="submit">Register</button>
      </form>
    </main>
  );
}
