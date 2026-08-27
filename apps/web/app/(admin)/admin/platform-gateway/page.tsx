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

type Provider = "raast" | "easypaisa" | "jazzcash" | "bank";

const PROVIDER_LABEL: Record<Provider, string> = { raast: "Raast", easypaisa: "Easypaisa", jazzcash: "JazzCash", bank: "Bank transfer" };

interface PlatformGatewayConnection {
  id: string;
  provider: Provider;
  merchantId: string | null;
  isActive: boolean;
  verifiedCount: number;
  failedCount: number;
  lastVerifiedAt: string | null;
  lastFailedAt: string | null;
  connectedAt: string;
}

/**
 * Founder-directed scope addition - "Platform Merchant Connection." UZEYN
 * itself as the connected merchant (Module 62's exact adapter
 * architecture), gating AUTOMATIC verification of a seller's own plan-fee
 * payment or Premium Motion Templates purchase, instead of the manual
 * bank-instructions + admin-confirm flow those keep using otherwise.
 * Dormant by default (schema's own `isActive @default(false)`) - a fresh
 * connection never auto-activates; this page's own "Activate" toggle is
 * the one explicit step that turns it on, and it's disabled here until an
 * admin has actually saved real credentials.
 */
export default function AdminPlatformGatewayPage() {
  const confirm = useConfirm();
  const [connections, setConnections] = useState<PlatformGatewayConnection[] | null>(null);
  const [provider, setProvider] = useState<Provider>("easypaisa");
  const [merchantId, setMerchantId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  function load() {
    adminApi
      .get<PlatformGatewayConnection[]>("/admin/platform-gateway")
      .then(setConnections)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load platform gateway connections."));
  }

  useEffect(load, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    try {
      await adminApi.post("/admin/platform-gateway", {
        provider,
        merchantId: merchantId || undefined,
        apiKey,
        apiSecret: apiSecret || undefined,
      });
      setStatus(`Saved ${PROVIDER_LABEL[provider]} - still dormant until you activate it below.`);
      setMerchantId("");
      setApiKey("");
      setApiSecret("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't save this connection.");
    }
  }

  async function toggleActive(connection: PlatformGatewayConnection) {
    if (!connection.isActive) {
      const ok = await confirm({
        title: `Activate ${PROVIDER_LABEL[connection.provider]} as the platform merchant?`,
        description:
          "From this moment, a seller's plan-fee payment or template purchase with a matching reference is verified and granted AUTOMATICALLY through this connection - no admin step. Only activate once you've confirmed these are real, working merchant credentials.",
        confirmLabel: "Activate",
        tone: "danger",
      });
      if (!ok) return;
    }
    setError(null);
    try {
      await adminApi.patch(`/admin/platform-gateway/${connection.provider}/active`, { isActive: !connection.isActive });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't update this connection.");
    }
  }

  async function testConnection(connection: PlatformGatewayConnection) {
    setTestResult((prev) => ({ ...prev, [connection.provider]: "Testing..." }));
    try {
      const result = await adminApi.post<{ success: boolean }>(`/admin/platform-gateway/${connection.provider}/test`);
      setTestResult((prev) => ({ ...prev, [connection.provider]: result.success ? "Connection OK" : "Test failed" }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [connection.provider]: err instanceof AdminApiError ? err.message : "Test failed." }));
    }
  }

  async function remove(connection: PlatformGatewayConnection) {
    const ok = await confirm({
      title: `Remove the ${PROVIDER_LABEL[connection.provider]} connection?`,
      description: "This deletes the saved credentials entirely. Auto-verification for this provider stops immediately; the manual bank-instructions flow is unaffected.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    await adminApi.delete(`/admin/platform-gateway/${connection.provider}`);
    load();
  }

  if (!connections) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Platform merchant connection"
        description="UZEYN as its own connected merchant (same Easypaisa/JazzCash/Raast/bank adapters a seller's own store connects) - once activated, a plan-fee payment or template purchase verifies and grants automatically instead of waiting on manual bank instructions + an admin confirm. Dormant until you connect real credentials and explicitly activate."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {status && <Alert tone="success">{status}</Alert>}

      <div className="max-w-3xl space-y-4">
        <DashCard className="divide-y divide-border">
          {connections.length === 0 ? (
            <p className="py-3 text-sm text-ink-muted">No providers connected yet. The manual bank-instructions flow is the only active path.</p>
          ) : (
            connections.map((c) => (
              <div key={c.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {PROVIDER_LABEL[c.provider]}
                      <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "active - auto-verifying" : "dormant"}</Badge>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {c.merchantId ? `Merchant ID: ${c.merchantId} · ` : ""}
                      {c.verifiedCount} verified · {c.failedCount} failed
                      {c.lastVerifiedAt && ` · last verified ${new Date(c.lastVerifiedAt).toLocaleString()}`}
                      {c.lastFailedAt && ` · last failed ${new Date(c.lastFailedAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => testConnection(c)}>
                      Test connection
                    </Button>
                    <Button variant={c.isActive ? "secondary" : "primary"} size="sm" onClick={() => toggleActive(c)}>
                      {c.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(c)}>
                      Remove
                    </Button>
                  </div>
                </div>
                {testResult[c.provider] && <p className="text-xs text-ink-muted">{testResult[c.provider]}</p>}
              </div>
            ))
          )}
        </DashCard>

        <DashCard>
          <DashCardHeader title="Connect (or reconnect with fresh credentials)" />
          <form onSubmit={connect} className="space-y-3">
            <Field label="Provider">
              <Select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                <option value="raast">Raast</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="jazzcash">JazzCash</option>
                <option value="bank">Bank transfer</option>
              </Select>
            </Field>
            <Field label="Merchant ID (optional)">
              <Input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} />
            </Field>
            <Field label="API key">
              <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
            </Field>
            <Field label="API secret (optional)">
              <Input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} type="password" />
            </Field>
            <Button type="submit">Save connection</Button>
          </form>
        </DashCard>
      </div>
    </div>
  );
}
