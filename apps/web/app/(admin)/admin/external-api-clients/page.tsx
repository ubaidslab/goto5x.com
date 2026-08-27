"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

type ClientType = "template_store" | "social_media_saas";

interface ExternalApiClient {
  id: string;
  clientType: ClientType;
  displayName: string;
  isEnabled: boolean;
  hasSigningSecret: boolean;
}

const CLIENT_TYPE_LABEL: Record<ClientType, string> = { template_store: "Template Store", social_media_saas: "Social Media SaaS" };

/**
 * Phase 6f (Admin Terminal re-skin) - SRS FR-8.14/§3.10's external API
 * client registry, restyled onto DashCard. Every action preserved:
 * register, enable/disable, regenerate secret (confirm-gated, shown-once
 * reveal). Switched from hand-rolled fetch to adminApi.
 */
export default function AdminExternalApiClientsPage() {
  const confirm = useConfirm();
  const [clients, setClients] = useState<ExternalApiClient[] | null>(null);
  const [clientType, setClientType] = useState<ClientType>("template_store");
  const [displayName, setDisplayName] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminApi
      .get<ExternalApiClient[]>("/admin/external-api-clients")
      .then(setClients)
      .catch(() => setClients([]));
  }

  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRevealedSecret(null);
    try {
      const body = await adminApi.post<{ signingSecret: string }>("/admin/external-api-clients", { clientType, displayName });
      setRevealedSecret(body.signingSecret);
      setDisplayName("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create that client.");
    }
  }

  async function toggle(id: string, isEnabled: boolean) {
    await adminApi.patch(`/admin/external-api-clients/${id}`, { isEnabled });
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
    const body = await adminApi.post<{ signingSecret: string }>(`/admin/external-api-clients/${id}/regenerate-secret`);
    setRevealedSecret(body.signingSecret);
    load();
  }

  if (!clients) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="External API Clients"
        description="Template Store and Social Media SaaS hooks (SRS §5.24). uzeyn.com never builds either external product - only this small, versioned API surface."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {revealedSecret && (
        <Alert tone="success">
          Signing secret (shown once - copy it now): <code className="font-mono">{revealedSecret}</code>
        </Alert>
      )}

      <div className="max-w-3xl space-y-4">
        <DashCard className="divide-y divide-border">
          {clients.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {c.displayName} <span className="font-normal text-ink-muted">({CLIENT_TYPE_LABEL[c.clientType]})</span>
                </p>
                <p className="text-xs text-ink-muted">{c.hasSigningSecret ? "Has a signing secret" : "No signing secret set"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={c.isEnabled ? "success" : "neutral"}>{c.isEnabled ? "enabled" : "disabled"}</Badge>
                <Button variant="ghost" size="sm" onClick={() => toggle(c.id, !c.isEnabled)}>
                  {c.isEnabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => regenerateSecret(c.id, c.displayName)}>
                  Regenerate secret
                </Button>
              </div>
            </div>
          ))}
        </DashCard>

        <DashCard>
          <DashCardHeader title="Register a client" />
          <form onSubmit={create} className="space-y-3">
            <Field label="Type">
              <Select value={clientType} onChange={(e) => setClientType(e.target.value as ClientType)}>
                <option value="template_store">Template Store</option>
                <option value="social_media_saas">Social Media SaaS</option>
              </Select>
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
