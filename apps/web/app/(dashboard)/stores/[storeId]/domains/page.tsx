"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type VerificationStatus = "pending" | "verified" | "failed";
type TlsStatus = "pending" | "issued" | "error";

interface DomainRecord {
  id: string;
  domainName: string;
  verificationStatus: VerificationStatus;
  tlsStatus: TlsStatus;
  createdAt: string;
}

interface DomainsConfig {
  cnameTarget: string;
  aRecordIp: string;
  referral: { url: string; partnerName: string } | null;
}

const verificationTone: Record<VerificationStatus, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  verified: "success",
  failed: "danger",
};

/**
 * SRS FR-11.2 (attach/verify a custom domain) had a backend since Module 3
 * but no seller-facing screen - built here to that same already-approved
 * shape, now also hosting the FR-11.3 referral block (v0.18).
 */
export default function DomainsPage({ params }: { params: { storeId: string } }) {
  const [domains, setDomains] = useState<DomainRecord[] | null>(null);
  const [config, setConfig] = useState<DomainsConfig | null>(null);
  const [domainName, setDomainName] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<DomainRecord[]>(`/stores/${params.storeId}/domains`)
      .then(setDomains)
      .catch(() => setDomains([]));
  }

  useEffect(() => {
    load();
    api
      .get<DomainsConfig>(`/stores/${params.storeId}/domains/config`)
      .then(setConfig)
      .catch(() => {});
  }, [params.storeId]);

  if (!domains) return <PageSpinner />;

  async function attach(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAttaching(true);
    try {
      await api.post(`/stores/${params.storeId}/domains`, { domainName });
      setDomainName("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't attach that domain.");
    } finally {
      setAttaching(false);
    }
  }

  async function verifyNow(domainId: string) {
    setError(null);
    setVerifyingId(domainId);
    try {
      await api.post(`/stores/${params.storeId}/domains/${domainId}/verify`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't verify that domain right now.");
    } finally {
      setVerifyingId(null);
    }
  }

  async function remove(domainId: string) {
    setError(null);
    try {
      await api.delete(`/stores/${params.storeId}/domains/${domainId}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that domain.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Domains"
        description="Every store gets a free uzeyn.com subdomain automatically - attaching your own domain here is optional."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Attach a custom domain" description="Point your domain's DNS at uzeyn.com, then verify it here." />
          <CardBody className="space-y-4">
            <form onSubmit={attach} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Domain name">
                  <Input
                    placeholder="shop.example.com"
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Button type="submit" loading={attaching}>
                Attach
              </Button>
            </form>
            {config && (
              <div className="rounded-md border border-border bg-canvas p-3 text-xs text-ink-muted">
                <p>
                  <span className="font-medium text-ink">CNAME</span> (subdomains) &rarr; {config.cnameTarget}
                </p>
                <p>
                  <span className="font-medium text-ink">A record</span> (root/apex domains) &rarr; {config.aRecordIp}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {domains.length === 0 ? (
          <Card>
            <EmptyState
              title="No custom domains attached"
              description="Your store is reachable on its free subdomain until you attach one of your own."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {domains.map((domain) => (
              <div key={domain.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-ink">{domain.domainName}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    TLS: {domain.tlsStatus} · Attached {new Date(domain.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={verificationTone[domain.verificationStatus]}>{domain.verificationStatus}</Badge>
                  {domain.verificationStatus !== "verified" && (
                    <Button variant="secondary" size="sm" loading={verifyingId === domain.id} onClick={() => verifyNow(domain.id)}>
                      Verify now
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => remove(domain.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {config?.referral && (
          <Card>
            <CardBody className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Don&apos;t own a domain yet?</p>
                <p className="mt-0.5 text-xs text-ink-muted">Get one through {config.referral.partnerName}.</p>
              </div>
              <a href={config.referral.url} target="_blank" rel="noopener noreferrer nofollow">
                <Button variant="secondary" size="sm">
                  Get a domain
                </Button>
              </a>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
