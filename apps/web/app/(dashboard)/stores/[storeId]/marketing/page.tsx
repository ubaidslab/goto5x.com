"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface ApiToken {
  id: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  client: { displayName: string };
}

/**
 * SRS §5.24b/FR-24.8/FR-24.10 - the seller dashboard's hand-off point to the
 * founder's separate Social Media SaaS. Seller-scoped data (not store-scoped)
 * hosted under the store URL, same convention as Plans & Billing.
 */
export default function MarketingPage({ params }: { params: { storeId: string } }) {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);

  function load() {
    api
      .get<ApiToken[]>("/sellers/me/api-tokens")
      .then(setTokens)
      .catch(() => setTokens([]));
  }

  useEffect(() => {
    load();
  }, []);

  if (!tokens) return <PageSpinner />;

  async function connect() {
    setError(null);
    setNewToken(null);
    setConnecting(true);
    try {
      const res = await api.post<{ id: string; token: string }>("/sellers/me/api-tokens", {});
      setNewToken(res.token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't connect the Social Media SaaS yet.");
    } finally {
      setConnecting(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await api.delete(`/sellers/me/api-tokens/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that connection.");
    }
  }

  async function openMarketingSaas() {
    setError(null);
    setHandingOff(true);
    try {
      const res = await api.post<{ url: string }>("/sellers/me/marketing-handoff", {});
      window.open(res.url, "_blank", "noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The Marketing app isn't available yet.");
    } finally {
      setHandingOff(false);
    }
  }

  const active = tokens.filter((t) => !t.revokedAt);

  return (
    <div>
      <PageHeader title="Marketing" />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader title="Social Media SaaS" />
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-muted">
            Post directly to social media using your product catalog - no second signup, no second password.
          </p>
          <Button onClick={openMarketingSaas} loading={handingOff}>
            Open Marketing app &rarr;
          </Button>

          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">Connected apps</h3>
            {newToken && (
              <Alert tone="success">
                Connection created. Copy this token now - it won&apos;t be shown again: <code>{newToken}</code>
              </Alert>
            )}
            {active.length === 0 ? (
              <p className="text-sm text-ink-muted">No apps connected yet.</p>
            ) : (
              <ul className="space-y-2">
                {active.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm text-ink">{t.client.displayName}</p>
                      <p className="text-xs text-ink-muted">Connected {new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => revoke(t.id)}>
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={connect} loading={connecting}>
                Connect
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
