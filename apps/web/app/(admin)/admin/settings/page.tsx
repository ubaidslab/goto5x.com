"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";

type ScopeType = "global" | "plan" | "seller" | "category" | "store" | "supplier";

interface SettingsDefinition {
  key: string;
  valueType: "boolean" | "number" | "string" | "json";
  allowedScopes: ScopeType[];
  defaultValue: unknown;
  description?: string;
  validation?: { min?: number; max?: number } | null;
  requiresConfirmation: boolean;
}

interface ChainEntry {
  scope: ScopeType;
  scopeId: string | null;
  hasOverride: boolean;
  value: unknown;
  updatedBy: string | null;
  updatedByEmail: string | null;
  updatedAt: string | null;
}

interface ResolveResponse {
  key: string;
  valueType: string;
  allowedScopes: ScopeType[];
  defaultValue: unknown;
  effectiveValue: unknown;
  winningScope: ScopeType | "default";
  requiresConfirmation: boolean;
  chain: ChainEntry[];
}

const SCOPE_QUERY_PARAM: Record<Exclude<ScopeType, "global">, string> = {
  seller: "sellerId",
  store: "storeId",
  plan: "planId",
  supplier: "supplierId",
  category: "categoryId",
};

/**
 * Module 25 (Admin Completion) - the Settings Registry write UI (§14 gap:
 * ~90 keys existed with zero write UI, every change needed a raw API
 * call). Type-aware validation mirrors the server's own
 * SettingsService.validateValue() rules so a bad value is rejected before
 * the request even fires; the precedence chain view reuses
 * SettingsService's own PRECEDENCE order (via the new
 * GET admin/settings/resolve endpoint) so "which scope wins" is never a
 * guess. High-impact-key detection (FR-8.16, v0.40) is the data-driven
 * `requiresConfirmation` field on the definition itself, resolved through
 * to this page via GET admin/settings/resolve - no more frontend
 * key.startsWith("billing.")-style guessing.
 */
export default function AdminSettingsPage() {
  const confirm = useConfirm();
  const [definitions, setDefinitions] = useState<SettingsDefinition[]>([]);
  const [selected, setSelected] = useState<SettingsDefinition | null>(null);
  const [scope, setScope] = useState<ScopeType>("global");
  const [scopeId, setScopeId] = useState("");
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [valueInput, setValueInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.get<SettingsDefinition[]>("/admin/settings/definitions").then(setDefinitions).catch(() => {});
  }, []);

  async function selectDefinition(d: SettingsDefinition) {
    setSelected(d);
    setScope("global");
    setScopeId("");
    setError(null);
    setSaved(false);
    await refreshResolve(d.key, "global", "");
  }

  async function refreshResolve(key: string, s: ScopeType, id: string) {
    const params = new URLSearchParams({ key });
    if (s !== "global" && id) params.set(SCOPE_QUERY_PARAM[s], id);
    const result = await adminApi.get<ResolveResponse>(`/admin/settings/resolve?${params.toString()}`);
    setResolved(result);
    setValueInput(JSON.stringify(result.effectiveValue));
  }

  function validateClientSide(d: SettingsDefinition, raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
    let value: unknown;
    try {
      if (d.valueType === "boolean") value = raw === "true";
      else if (d.valueType === "number") value = Number(raw);
      else if (d.valueType === "json") value = JSON.parse(raw);
      else value = raw;
    } catch {
      return { ok: false, message: "That value isn't valid JSON." };
    }

    if (d.valueType === "number") {
      if (typeof value !== "number" || Number.isNaN(value)) return { ok: false, message: "Value must be a number." };
      if (d.validation?.min !== undefined && value < d.validation.min) {
        return { ok: false, message: `Value must be at least ${d.validation.min}.` };
      }
      if (d.validation?.max !== undefined && value > d.validation.max) {
        return { ok: false, message: `Value must be at most ${d.validation.max}.` };
      }
    }
    if (d.valueType === "string" && typeof value !== "string") {
      return { ok: false, message: "Value must be a string." };
    }
    return { ok: true, value };
  }

  async function save() {
    if (!selected) return;
    setError(null);
    setSaved(false);

    if (scope !== "global" && !scopeId.trim()) {
      setError("A scope ID is required for a non-global override.");
      return;
    }

    const validation = validateClientSide(selected, valueInput);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    if (resolved?.requiresConfirmation) {
      const ok = await confirm({
        title: `Change "${selected.key}"?`,
        description: "This is a high-impact settings key (FR-8.16) - a bad value here does real financial/availability damage.",
        changes: [{ label: selected.key, from: JSON.stringify(resolved.effectiveValue), to: JSON.stringify(validation.value) }],
        confirmLabel: "Apply change",
        tone: "danger",
      });
      if (!ok) return;
    }

    try {
      await adminApi.put("/admin/settings/values", {
        key: selected.key,
        scopeType: scope,
        scopeId: scope === "global" ? null : scopeId,
        value: validation.value,
      });
      setSaved(true);
      await refreshResolve(selected.key, scope, scopeId);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't save this value.");
    }
  }

  return (
    <main>
      <h1>Settings Registry</h1>
      <p>Every platform setting. Select one to view its current effective value, precedence chain, and edit it.</p>

      <div style={{ display: "flex", gap: 24 }}>
        <table border={1} cellPadding={4} style={{ flex: 1 }}>
          <thead>
            <tr>
              <th>Key</th>
              <th>Type</th>
              <th>Default</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((d) => (
              <tr key={d.key}>
                <td>{d.key}</td>
                <td>{d.valueType}</td>
                <td>{JSON.stringify(d.defaultValue)}</td>
                <td>
                  <button onClick={() => selectDefinition(d)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected && resolved && (
          <div style={{ flex: 1, border: "1px solid #ccc", padding: 12 }}>
            <h2>{selected.key}</h2>
            <p>{selected.description}</p>

            <h3>Precedence chain</h3>
            <table border={1} cellPadding={4}>
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Override?</th>
                  <th>Value</th>
                  <th>Last changed by</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {resolved.chain.map((c) => (
                  <tr key={c.scope} style={{ fontWeight: c.scope === resolved.winningScope ? "bold" : "normal" }}>
                    <td>{c.scope}</td>
                    <td>{c.hasOverride ? "yes" : "no"}</td>
                    <td>{c.hasOverride ? JSON.stringify(c.value) : "-"}</td>
                    <td>{c.updatedByEmail ?? "-"}</td>
                    <td>{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
                <tr>
                  <td>default</td>
                  <td>-</td>
                  <td>{JSON.stringify(resolved.defaultValue)}</td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
            <p>
              Effective value right now: <strong>{JSON.stringify(resolved.effectiveValue)}</strong> (winning scope: {resolved.winningScope})
            </p>

            <h3>Set a value</h3>
            <label>
              Scope:{" "}
              <select
                value={scope}
                onChange={(e) => {
                  const s = e.target.value as ScopeType;
                  setScope(s);
                  refreshResolve(selected.key, s, scopeId);
                }}
              >
                {selected.allowedScopes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {scope !== "global" && (
              <label>
                {" "}
                Scope ID:{" "}
                <input
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  onBlur={() => refreshResolve(selected.key, scope, scopeId)}
                />
              </label>
            )}

            <p>
              {selected.valueType === "boolean" ? (
                <select value={valueInput} onChange={(e) => setValueInput(e.target.value)}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : selected.valueType === "json" ? (
                <textarea value={valueInput} onChange={(e) => setValueInput(e.target.value)} rows={4} style={{ width: "100%" }} />
              ) : (
                <input value={valueInput} onChange={(e) => setValueInput(e.target.value)} style={{ width: "100%" }} />
              )}
            </p>
            {selected.validation && (selected.validation.min !== undefined || selected.validation.max !== undefined) && (
              <p>
                Allowed range: {selected.validation.min ?? "-"} to {selected.validation.max ?? "-"}
              </p>
            )}

            {error && <p style={{ color: "red" }}>{error}</p>}
            {saved && <p style={{ color: "green" }}>Saved.</p>}
            <button onClick={save}>Save</button>
          </div>
        )}
      </div>
    </main>
  );
}
