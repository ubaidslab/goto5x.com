"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface Product {
  id: string;
}
interface Order {
  id: string;
  status: string;
}
interface StoreSummary {
  id: string;
  publishedAt: string | null;
}
interface OnboardingProgress {
  theme: boolean;
  logo: boolean;
  product: boolean;
  domain: boolean;
  completedAt: string | null;
}

/**
 * Module 16 (SRS §5.20/FR-20.1) - the guided post-signup checklist. Steps
 * are read from real store state wherever possible (a seller who already
 * did the thing never has to also click an "I did this" button); the theme
 * and domain steps additionally accept an explicit acknowledgment, since
 * keeping the default theme or the free subdomain is a valid choice with no
 * other action to detect.
 */
function OnboardingWizard({
  storeId,
  progress,
  onAcknowledged,
}: {
  storeId: string;
  progress: OnboardingProgress;
  onAcknowledged: () => void;
}) {
  const [acking, setAcking] = useState<"theme" | "domain" | null>(null);

  async function ack(step: "theme" | "domain") {
    setAcking(step);
    try {
      await api.post(`/stores/${storeId}/onboarding/${step}-ack`, {});
      onAcknowledged();
    } finally {
      setAcking(null);
    }
  }

  const steps: Array<{
    key: keyof Omit<OnboardingProgress, "completedAt">;
    label: string;
    description: string;
    action: React.ReactNode;
  }> = [
    {
      key: "theme",
      label: "Pick a theme",
      description: "Choose how your storefront looks, or keep the default.",
      action: progress.theme ? null : (
        <div className="flex gap-2">
          <Link href={`/stores/${storeId}/customizer`}>
            <Button size="sm" variant="secondary">
              Choose a theme
            </Button>
          </Link>
          <Button size="sm" variant="ghost" loading={acking === "theme"} onClick={() => ack("theme")}>
            Keep this theme
          </Button>
        </div>
      ),
    },
    {
      key: "logo",
      label: "Set a logo",
      description: "Shown on your storefront, invoices, and order emails.",
      action: progress.logo ? null : (
        <Link href={`/stores/${storeId}/settings`}>
          <Button size="sm" variant="secondary">
            Upload a logo
          </Button>
        </Link>
      ),
    },
    {
      key: "product",
      label: "Add a product",
      description: "Give it a title, a price, and a quantity to get started.",
      action: progress.product ? null : (
        <Link href={`/stores/${storeId}/products/new`}>
          <Button size="sm" variant="secondary">
            Add a product
          </Button>
        </Link>
      ),
    },
    {
      key: "domain",
      label: "Configure a domain",
      description: "Attach your own domain, or use the free uzeyn.com subdomain.",
      action: progress.domain ? null : (
        <div className="flex gap-2">
          <Link href={`/stores/${storeId}/domains`}>
            <Button size="sm" variant="secondary">
              Add a domain
            </Button>
          </Link>
          <Button size="sm" variant="ghost" loading={acking === "domain"} onClick={() => ack("domain")}>
            Use free subdomain
          </Button>
        </div>
      ),
    },
  ];

  const doneCount = steps.filter((s) => progress[s.key]).length;

  return (
    <div>
      <PageHeader
        title="Get your store ready"
        description={`${doneCount} of ${steps.length} steps done - complete them to finish setting up your store.`}
      />
      <Card>
        <CardHeader title="Setup checklist" />
        <CardBody className="divide-y divide-border">
          {steps.map((step) => (
            <div key={step.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">{step.label}</p>
                  <Badge tone={progress[step.key] ? "success" : "neutral"}>{progress[step.key] ? "Done" : "To do"}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{step.description}</p>
              </div>
              {step.action}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Dashboard home - a seller's first screen after picking a store. Answers
 * "what's the state of my store right now?" at a glance (SIMPLICITY
 * INVARIANT rule (a)) and, for a brand-new store with no products yet,
 * leads with the single next action rather than empty stat tiles (rule (e)).
 */
export default function DashboardHomePage({ params }: { params: { storeId: string } }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [store, setStore] = useState<StoreSummary | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  function refreshOnboarding() {
    api
      .get<OnboardingProgress>(`/stores/${params.storeId}/onboarding`)
      .then(setOnboarding)
      .catch(() => setOnboarding({ theme: true, logo: true, product: true, domain: true, completedAt: new Date().toISOString() }));
  }

  function refreshStore() {
    api.get<StoreSummary>(`/stores/${params.storeId}`).then(setStore).catch(() => {});
  }

  useEffect(() => {
    api
      .get<{ items: Product[] }>(`/stores/${params.storeId}/products?limit=100`)
      .then((page) => setProducts(page.items))
      .catch(() => setProducts([]));
    api
      .get<{ items: Order[] }>(`/stores/${params.storeId}/orders?limit=100`)
      .then((page) => setOrders(page.items))
      .catch(() => setOrders([]));
    refreshOnboarding();
    refreshStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.storeId]);

  async function publish() {
    setPublishError(null);
    setPublishing(true);
    try {
      await api.post(`/stores/${params.storeId}/publish`, {});
      refreshStore();
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Could not publish this store.");
    } finally {
      setPublishing(false);
    }
  }

  if (products === null || orders === null || onboarding === null || store === null) return <PageSpinner />;

  // Module 16 (FR-20.1) - while onboarding is incomplete, the wizard takes
  // over the dashboard home's main content (the rest of the dashboard stays
  // reachable via the sidebar the whole time - see the store layout). Once
  // complete, this branch is never reached again (onboardingCompletedAt is
  // sticky server-side), and the dashboard behaves exactly as before Module 16.
  if (!onboarding.completedAt) {
    return <OnboardingWizard storeId={params.storeId} progress={onboarding} onAcknowledged={refreshOnboarding} />;
  }

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  if (products.length === 0) {
    return (
      <div>
        <PageHeader title="Welcome to your store" description="Let's get your first product live." />
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-16 text-center">
            <div>
              <h2 className="text-base font-semibold text-ink">Add your first product</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
                Once you add a product with at least one price and quantity, your store is ready to start taking orders.
              </p>
            </div>
            <Link href={`/stores/${params.storeId}/products/new`}>
              <Button>Add a product</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Module 20 (SRS §5.6e, FR-6.21) - the explicit "go live" moment: a
  // seller with products still needs to publish before real orders can
  // complete. publish() itself checks payment method + CNIC + minimum
  // wallet top-up and returns a clear message if any is missing.
  if (!store.publishedAt) {
    return (
      <div>
        <PageHeader title="Publish your store" description="One last step before you can accept real orders." />
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-16 text-center">
            <div>
              <h2 className="text-base font-semibold text-ink">Ready to go live?</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
                Publishing requires a payment method, identity verification, and a minimum wallet top-up - all
                one-time steps.
              </p>
            </div>
            {publishError && <Alert>{publishError}</Alert>}
            <div className="flex gap-2">
              <Button loading={publishing} onClick={publish}>
                Publish store
              </Button>
              <Link href={`/stores/${params.storeId}/wallet`}>
                <Button variant="secondary">Top up wallet</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Here's what's happening in your store." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={`/stores/${params.storeId}/products`}>
          <Card className="transition-smooth hover:shadow-md">
            <CardBody>
              <p className="text-sm text-ink-muted">Products</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{products.length}</p>
            </CardBody>
          </Card>
        </Link>
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">Orders awaiting payment</p>
            <p className="mt-1 text-3xl font-semibold text-ink">{pendingOrders}</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
