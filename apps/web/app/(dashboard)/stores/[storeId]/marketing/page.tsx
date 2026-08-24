"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/dashboard/ConfirmDialogProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { UpgradeLockedCard } from "@/components/ui/UpgradeLockedCard";
import { toast } from "@/lib/use-toast";
import { ApiError, api } from "@/lib/dashboard-api";

interface ApiToken {
  id: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
  client: { displayName: string };
}

interface SocialMediaFeedStatus {
  metaCatalogFeedEnabled: boolean;
  whatsappProductShareEnabled: boolean;
  metaCatalogFeedPath: string;
}

interface ProductOption {
  id: string;
  title: string;
  status: string;
}

/**
 * SRS §5.24b/FR-24.8/FR-24.10 - the seller dashboard's hand-off point to the
 * founder's separate Social Media SaaS. Seller-scoped data (not store-scoped)
 * hosted under the store URL, same convention as Plans & Billing.
 */
export default function MarketingPage({ params }: { params: { storeId: string } }) {
  const confirm = useConfirm();
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [feedStatus, setFeedStatus] = useState<SocialMediaFeedStatus | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [shareProductId, setShareProductId] = useState("");
  const [generatingShareLink, setGeneratingShareLink] = useState(false);

  function load() {
    api
      .get<ApiToken[]>("/sellers/me/api-tokens")
      .then(setTokens)
      .catch(() => setTokens([]));
  }

  useEffect(() => {
    load();
    api
      .get<SocialMediaFeedStatus>("/sellers/me/api-tokens/social-media-feed-status")
      .then(setFeedStatus)
      .catch(() => setFeedStatus(null));
    api
      .get<{ items: ProductOption[] }>(`/stores/${params.storeId}/products?limit=100`)
      .then((res) => setProducts(res.items.filter((p) => p.status === "active")))
      .catch(() => setProducts([]));
  }, [params.storeId]);

  async function generateShareLink() {
    if (!shareProductId) return;
    setError(null);
    setGeneratingShareLink(true);
    try {
      const { deepLink } = await api.get<{ deepLink: string }>(`/stores/${params.storeId}/whatsapp/products/${shareProductId}/share-link`);
      window.open(deepLink, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate that share link.");
    } finally {
      setGeneratingShareLink(false);
    }
  }

  async function copyFeedUrl() {
    if (!feedStatus) return;
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}${feedStatus.metaCatalogFeedPath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: "success", title: "Feed URL copied" });
    } catch {
      toast({ tone: "danger", title: "Couldn't copy - select and copy the URL manually" });
    }
  }

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

  async function revoke(id: string, displayName: string) {
    const ok = await confirm({
      title: "Revoke this connection?",
      description: `${displayName} will immediately lose access to your store's catalog. This can't be undone - reconnecting issues a new token.`,
      confirmLabel: "Revoke",
      tone: "danger",
    });
    if (!ok) return;
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
      <PageHeader
        title="Marketing"
        description="Connect your store to marketing tools like the Social Media SaaS to promote your catalog."
      />
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
              <EmptyState title="No apps connected yet" description="Connect below to start posting your catalog to social media." />
            ) : (
              <Reveal stagger={0.05} className="space-y-2">
                {active.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm text-ink">{t.client.displayName}</p>
                      <p className="text-xs text-ink-muted">Connected {new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => revoke(t.id, t.client.displayName)}>
                      Revoke
                    </Button>
                  </div>
                ))}
              </Reveal>
            )}
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={connect} loading={connecting}>
                Connect
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Reveal>
      <Card className="mt-6">
        <CardHeader title="Facebook & Instagram Shop feed" description="A product catalog feed for Meta Commerce Manager - same connected token as above." />
        {feedStatus === null ? (
          <CardBody>
            <PageSpinner />
          </CardBody>
        ) : feedStatus.metaCatalogFeedEnabled ? (
          <CardBody className="space-y-3">
            <p className="text-sm text-ink-muted">
              In Meta Commerce Manager, add this as a data feed URL, authenticated with a Bearer token from your connected app above (create one
              if you haven&apos;t yet).
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-canvas px-3 py-2 text-xs text-ink">
                {process.env.NEXT_PUBLIC_API_BASE_URL}
                {feedStatus.metaCatalogFeedPath}
              </code>
              <Button variant="secondary" size="sm" onClick={copyFeedUrl}>
                Copy
              </Button>
            </div>
          </CardBody>
        ) : (
          <UpgradeLockedCard
            requiredTier="RISE"
            title="The Meta catalog feed is a RISE+ feature"
            description="Sync your active products straight into Facebook & Instagram Shop, once you're on RISE or FLY."
            action={
              <Link href={`/stores/${params.storeId}/billing`}>
                <Button size="sm" variant="secondary">
                  View plans
                </Button>
              </Link>
            }
          />
        )}
      </Card>
      </Reveal>

      <Reveal>
      <Card className="mt-6">
        <CardHeader title="WhatsApp product-share link" description="A share link for one product, opening WhatsApp's own contact picker." />
        {feedStatus === null ? (
          <CardBody>
            <PageSpinner />
          </CardBody>
        ) : feedStatus.whatsappProductShareEnabled ? (
          <CardBody className="flex flex-wrap items-end gap-3">
            <div className="min-w-64">
              <Field label="Product">
                <Select value={shareProductId} onChange={(e) => setShareProductId(e.target.value)} disabled={products.length === 0}>
                  <option value="">Select a published product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button loading={generatingShareLink} disabled={!shareProductId} onClick={generateShareLink}>
              Generate share link
            </Button>
          </CardBody>
        ) : (
          <UpgradeLockedCard
            requiredTier="RISE"
            title="WhatsApp product sharing is a RISE+ feature"
            description="Generate a one-tap share link for any published product, once you're on RISE or FLY."
            action={
              <Link href={`/stores/${params.storeId}/billing`}>
                <Button size="sm" variant="secondary">
                  View plans
                </Button>
              </Link>
            }
          />
        )}
      </Card>
      </Reveal>
    </div>
  );
}
