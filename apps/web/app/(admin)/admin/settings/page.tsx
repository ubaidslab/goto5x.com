"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/motion/Reveal";

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
  expiresAt: string | null;
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
 * Phase 6f (Admin Terminal re-skin) - Module 25's Settings Registry write
 * UI, restyled onto DashCard as a two-column master/detail (definitions
 * list | selected key's precedence chain + edit form) - the founder's
 * standing directive for this phase is explicit that this page must stay
 * (or become more) granular, never simplified away.
 *
 * Deepened, not just restyled: `expiresAt` per chain entry was already
 * returned by resolveWithChain() (the D-Studio time-limited grants work)
 * but this generic editor never showed it or let an admin SET one - a
 * grant/override was only ever time-limited via the narrow Seller-360
 * D-Studio shortcut. Now every override row shows its expiry (or "no
 * expiry"), and the edit form has an optional "Expires at" field for any
 * scoped override on any key, since the write endpoint already accepted
 * `expiresAt` generically.
 */
export default function AdminSettingsPage() {
  const confirm = useConfirm();
  const [definitions, setDefinitions] = useState<SettingsDefinition[]>([]);
  const [selected, setSelected] = useState<SettingsDefinition | null>(null);
  const [scope, setScope] = useState<ScopeType>("global");
  const [scopeId, setScopeId] = useState("");
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [valueInput, setValueInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.get<SettingsDefinition[]>("/admin/settings/definitions").then(setDefinitions).catch(() => {});
  }, []);

  async function selectDefinition(d: SettingsDefinition) {
    setSelected(d);
    setScope("global");
    setScopeId("");
    setExpiresAtInput("");
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
        expiresAt: scope !== "global" && expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined,
      });
      setSaved(true);
      await refreshResolve(selected.key, scope, scopeId);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't save this value.");
    }
  }

  return (
    <div>
      <PageHeader title="Settings Registry" description="Every platform setting. Select one to view its current effective value, precedence chain, and edit it." />

      <div className="flex flex-col gap-4 lg:flex-row">
        <Reveal className="flex-1">
        <DashCard className="overflow-x-auto">
          <DashCardHeader title={`Definitions (${definitions.length})`} />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3">Key</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Default</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {definitions.map((d) => (
                <tr key={d.key} className={selected?.key === d.key ? "bg-accent-subtle" : undefined}>
                  <td className="py-2 pr-3 font-mono text-xs text-ink">{d.key}</td>
                  <td className="py-2 pr-3 text-ink-muted">{d.valueType}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-ink-muted">{JSON.stringify(d.defaultValue)}</td>
                  <td className="py-2 pr-3">
                    <Button variant="ghost" size="sm" onClick={() => selectDefinition(d)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashCard>
        </Reveal>

        {selected && resolved && (
          <DashCard className="flex-1">
            <DashCardHeader
              title={selected.key}
              description={selected.description}
              action={resolved.requiresConfirmation ? <Badge tone="danger">high-impact</Badge> : undefined}
            />

            <h3 className="mb-2 text-sm font-semibold text-ink">Precedence chain</h3>
            <div className="mb-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3">Scope</th>
                    <th className="py-2 pr-3">Override?</th>
                    <th className="py-2 pr-3">Value</th>
                    <th className="py-2 pr-3">Expires</th>
                    <th className="py-2 pr-3">Last changed by</th>
                    <th className="py-2 pr-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resolved.chain.map((c) => (
                    <tr key={c.scope} className={c.scope === resolved.winningScope ? "font-semibold" : undefined}>
                      <td className="py-2 pr-3 text-ink">{c.scope}</td>
                      <td className="py-2 pr-3 text-ink-muted">{c.hasOverride ? "yes" : "no"}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-ink-muted">{c.hasOverride ? JSON.stringify(c.value) : "-"}</td>
                      <td className="py-2 pr-3 text-ink-muted">
                        {c.hasOverride ? (
                          c.expiresAt ? (
                            <Badge tone="warning">until {new Date(c.expiresAt).toLocaleString()}</Badge>
                          ) : (
                            "no expiry"
                          )
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-ink-muted">{c.updatedByEmail ?? "-"}</td>
                      <td className="py-2 pr-3 text-ink-muted">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 pr-3 text-ink">default</td>
                    <td className="py-2 pr-3 text-ink-muted">-</td>
                    <td className="py-2 pr-3 font-mono text-xs text-ink-muted">{JSON.stringify(resolved.defaultValue)}</td>
                    <td className="py-2 pr-3 text-ink-muted">-</td>
                    <td className="py-2 pr-3 text-ink-muted">-</td>
                    <td className="py-2 pr-3 text-ink-muted">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mb-4 text-sm text-ink">
              Effective value right now: <strong>{JSON.stringify(resolved.effectiveValue)}</strong> (winning scope: {resolved.winningScope})
            </p>

            <h3 className="mb-2 text-sm font-semibold text-ink">Set a value</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="sm:w-40">
                  <Field label="Scope">
                    <Select
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
                    </Select>
                  </Field>
                </div>
                {scope !== "global" && (
                  <>
                    <div className="flex-1">
                      <Field label="Scope ID">
                        <Input value={scopeId} onChange={(e) => setScopeId(e.target.value)} onBlur={() => refreshResolve(selected.key, scope, scopeId)} />
                      </Field>
                    </div>
                    <div className="sm:w-56">
                      <Field label="Expires at (optional)">
                        <Input type="datetime-local" value={expiresAtInput} onChange={(e) => setExpiresAtInput(e.target.value)} />
                      </Field>
                    </div>
                  </>
                )}
              </div>

              <Field label="Value">
                {selected.valueType === "boolean" ? (
                  <Select value={valueInput} onChange={(e) => setValueInput(e.target.value)}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </Select>
                ) : selected.valueType === "json" ? (
                  <Textarea value={valueInput} onChange={(e) => setValueInput(e.target.value)} rows={4} className="font-mono text-xs" />
                ) : (
                  <Input value={valueInput} onChange={(e) => setValueInput(e.target.value)} />
                )}
              </Field>
              {selected.validation && (selected.validation.min !== undefined || selected.validation.max !== undefined) && (
                <p className="text-xs text-ink-muted">
                  Allowed range: {selected.validation.min ?? "-"} to {selected.validation.max ?? "-"}
                </p>
              )}

              {error && <Alert tone="danger">{error}</Alert>}
              {saved && <Alert tone="success">Saved.</Alert>}
              <Button onClick={save}>Save</Button>
            </div>
          </DashCard>
        )}
      </div>
    </div>
  );
}
