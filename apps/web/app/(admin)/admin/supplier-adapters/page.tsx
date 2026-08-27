"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

interface SupplierAdapter {
  id: string;
  adapterType: string;
  displayName: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Phase 6c (Admin Terminal re-skin) - Module 25 P1's supplier-adapter
 * registry (FR-4.9), restyled onto DashCard. Every action preserved:
 * register, enable/disable (confirm-gated), edit config JSON.
 */
export default function AdminSupplierAdaptersPage() {
  const confirm = useConfirm();
  const [adapters, setAdapters] = useState<SupplierAdapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adapterType, setAdapterType] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});

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
    setError(null);
    try {
      await adminApi.post("/admin/supplier-adapters", { adapterType, displayName });
      setAdapterType("");
      setDisplayName("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create this adapter.");
    }
  }

  async function toggleEnabled(adapter: SupplierAdapter) {
    const ok = await confirm({
      title: `${adapter.isEnabled ? "Disable" : "Enable"} "${adapter.displayName}"?`,
      description: adapter.isEnabled
        ? "Disabling this adapter stops all sync/order-routing traffic through it immediately."
        : "Enabling this adapter resumes sync/order-routing traffic through it.",
      changes: [{ label: "Enabled", from: adapter.isEnabled ? "yes" : "no", to: adapter.isEnabled ? "no" : "yes" }],
      confirmLabel: adapter.isEnabled ? "Disable" : "Enable",
      tone: adapter.isEnabled ? "danger" : "default",
    });
    if (!ok) return;
    await adminApi.patch(`/admin/supplier-adapters/${adapter.id}`, { isEnabled: !adapter.isEnabled });
    load();
  }

  async function saveConfig(adapterId: string) {
    setConfigErrors((prev) => ({ ...prev, [adapterId]: "" }));
    let config: unknown;
    try {
      config = JSON.parse(configDrafts[adapterId]);
    } catch {
      setConfigErrors((prev) => ({ ...prev, [adapterId]: "Config must be valid JSON." }));
      return;
    }
    try {
      await adminApi.patch(`/admin/supplier-adapters/${adapterId}`, { config });
      load();
    } catch (err) {
      setConfigErrors((prev) => ({ ...prev, [adapterId]: err instanceof AdminApiError ? err.message : "Couldn't save this config." }));
    }
  }

  if (error && !adapters) return <Alert tone="danger">{error}</Alert>;
  if (!adapters) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Supplier adapters" description="Register a new supplier integration, enable/disable one, or edit its config JSON - all without a deploy." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-4">
        {adapters.map((a) => (
          <DashCard key={a.id}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-ink">
                {a.displayName} <span className="font-normal text-ink-muted">({a.adapterType})</span>
              </p>
              <div className="flex items-center gap-2">
                <Badge tone={a.isEnabled ? "success" : "neutral"}>{a.isEnabled ? "enabled" : "disabled"}</Badge>
                <Button variant="ghost" size="sm" onClick={() => toggleEnabled(a)}>
                  {a.isEnabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
            {configErrors[a.id] && <Alert tone="danger">{configErrors[a.id]}</Alert>}
            <Textarea
              rows={5}
              value={configDrafts[a.id] ?? ""}
              onChange={(e) => setConfigDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
              className="font-mono text-xs"
            />
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => saveConfig(a.id)}>
              Save config
            </Button>
          </DashCard>
        ))}

        <DashCard>
          <DashCardHeader title="Register a new adapter" />
          <form onSubmit={create} className="space-y-3">
            <Field label="Adapter type (internal key)">
              <Input value={adapterType} onChange={(e) => setAdapterType(e.target.value)} required />
            </Field>
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </Field>
            <Button type="submit">Register</Button>
          </form>
        </DashCard>
      </div>
    </div>
  );
}
