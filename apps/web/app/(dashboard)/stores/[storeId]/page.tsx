"use client";

import { BarChart3, Clock, Receipt, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AvatarInitials } from "@/components/dashboard/ui/AvatarInitials";
import { DashCard, DashCardFooter, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { GaugeCard } from "@/components/dashboard/ui/Gauge";
import { Milestone, MilestoneBanner } from "@/components/dashboard/MilestoneBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";

interface Product {
  id: string;
}
interface Order {
  id: string;
  orderNumber: number;
  buyerEmail: string;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  placedAt: string;
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
interface AnalyticsOverview {
  repeatCustomerRate: number;
  returnRate: number;
  aov: number;
}
interface SalesBucketPoint {
  bucketStart: string;
  orderCount: number;
  revenue: number;
}

const statusTone: Record<OrderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  confirmed: "info",
  shipped: "info",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
  disputed: "danger",
};

/**
 * Phase 2 (UI/UX Design Phase) - the Gauge component's `percent` for an
 * absolute metric (Sales/Revenue) is a real period-over-period comparison
 * ratio, not an invented "% of goal" (see Gauge.tsx's own doc comment): how
 * much of the two 30-day windows' combined total happened in the current
 * one. 50% is flat, above is growth, below is decline.
 */
function periodRatio(current: number, prior: number): number {
  if (current === 0 && prior === 0) return 0;
  return Math.round((current / (current + prior)) * 100);
}

function periodChangeHint(current: number, prior: number): string {
  if (prior === 0) return current > 0 ? "New in the last 30 days" : "0% vs prior 30d";
  const change = Math.round(((current - prior) / prior) * 100);
  return `${change > 0 ? "+" : ""}${change}% vs prior 30d`;
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
      <DashCard>
        <DashCardHeader title="Setup checklist" />
        <div className="divide-y divide-border">
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
        </div>
      </DashCard>
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
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [salesOverTime, setSalesOverTime] = useState<SalesBucketPoint[] | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
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
    api
      .get<AnalyticsOverview>(`/stores/${params.storeId}/analytics/overview`)
      .then(setOverview)
      .catch(() => setOverview({ repeatCustomerRate: 0, returnRate: 0, aov: 0 }));
    api
      .get<{ milestone: Milestone | null }>(`/stores/${params.storeId}/milestones/recent`)
      .then((res) => setMilestone(res.milestone))
      .catch(() => setMilestone(null));
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);
    api
      .get<SalesBucketPoint[]>(`/stores/${params.storeId}/analytics/sales-over-time?bucket=day&start=${sixtyDaysAgo.toISOString()}`)
      .then(setSalesOverTime)
      .catch(() => setSalesOverTime([]));
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

  if (
    products === null ||
    orders === null ||
    onboarding === null ||
    store === null ||
    overview === null ||
    salesOverTime === null
  )
    return <PageSpinner />;

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
        <DashCard className="p-0">
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Add your first product"
            description="Once you add a product with at least one price and quantity, your store is ready to start taking orders."
            action={
              <Link href={`/stores/${params.storeId}/products/new`}>
                <Button>Add a product</Button>
              </Link>
            }
          />
        </DashCard>
      </div>
    );
  }

  // Module 73 (v0.38) - the explicit "go live" moment: a seller with
  // products still needs to publish before real orders can complete.
  // publish() itself checks payment method + identity verification only
  // now - the old minimum wallet top-up condition is dropped (wallet is
  // hidden; plan-fee payment is a separate, unrelated flow).
  if (!store.publishedAt) {
    return (
      <div>
        <PageHeader title="Publish your store" description="One last step before you can accept real orders." />
        <DashCard className="flex flex-col items-center gap-4 py-16 text-center">
          <div>
            <h2 className="text-base font-semibold text-ink">Ready to go live?</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
              Publishing requires a payment method and identity verification - both one-time steps.
            </p>
          </div>
          {publishError && <Alert>{publishError}</Alert>}
          <Button loading={publishing} onClick={publish}>
            Publish store
          </Button>
        </DashCard>
      </div>
    );
  }

  // Period-over-period comparison for the two absolute-metric gauges (Sales,
  // Revenue), computed client-side from the already-fetched 60-day window -
  // no separate backend endpoint for this exists or is needed.
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const currentWindow = salesOverTime.filter((p) => now - new Date(p.bucketStart).getTime() < thirtyDaysMs);
  const priorWindow = salesOverTime.filter((p) => {
    const age = now - new Date(p.bucketStart).getTime();
    return age >= thirtyDaysMs && age < thirtyDaysMs * 2;
  });
  const salesThisPeriod = currentWindow.reduce((sum, p) => sum + p.orderCount, 0);
  const salesPriorPeriod = priorWindow.reduce((sum, p) => sum + p.orderCount, 0);
  const revenueThisPeriod = currentWindow.reduce((sum, p) => sum + p.revenue, 0);
  const revenuePriorPeriod = priorWindow.reduce((sum, p) => sum + p.revenue, 0);
  const aovThisPeriod = salesThisPeriod > 0 ? revenueThisPeriod / salesThisPeriod : 0;
  const aovPriorPeriod = salesPriorPeriod > 0 ? revenuePriorPeriod / salesPriorPeriod : 0;
  const hasSalesHistory = salesOverTime.some((p) => p.orderCount > 0);

  const recentOrders = [...orders].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()).slice(0, 5);

  return (
    <div>
      <PageHeader title="Dashboard" description="Here's what's happening in your store." />

      <MilestoneBanner milestone={milestone} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GaugeCard
          icon={ShoppingBag}
          label="Sales (30d)"
          value={`${salesThisPeriod} order${salesThisPeriod === 1 ? "" : "s"}`}
          percent={periodRatio(salesThisPeriod, salesPriorPeriod)}
          hint={periodChangeHint(salesThisPeriod, salesPriorPeriod)}
          isEmpty={!hasSalesHistory}
          emptyMessage="No sales yet"
        />
        <GaugeCard
          icon={BarChart3}
          label="Revenue (30d)"
          value={`Rs ${revenueThisPeriod.toLocaleString()}`}
          percent={periodRatio(revenueThisPeriod, revenuePriorPeriod)}
          hint={periodChangeHint(revenueThisPeriod, revenuePriorPeriod)}
          isEmpty={!hasSalesHistory}
          emptyMessage="No sales yet"
        />
        <GaugeCard
          icon={Users}
          label="Repeat customers"
          value={`${overview.repeatCustomerRate}%`}
          percent={overview.repeatCustomerRate}
          hint="Ordered more than once"
          isEmpty={!hasSalesHistory}
          emptyMessage="No data yet"
        />
        <GaugeCard
          icon={Receipt}
          label="Average order value"
          value={`Rs ${Math.round(overview.aov).toLocaleString()}`}
          percent={periodRatio(aovThisPeriod, aovPriorPeriod)}
          hint={periodChangeHint(aovThisPeriod, aovPriorPeriod)}
          isEmpty={!hasSalesHistory}
          emptyMessage="No sales yet"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard className="lg:col-span-2">
          <DashCardHeader title="Recent orders" description="Your 5 most recent orders" />
          {recentOrders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-6 w-6" />}
              title="No orders yet"
              description="Orders will show up here as soon as buyers start checking out."
            />
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarInitials email={order.buyerEmail} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        #{order.orderNumber} &middot; {order.buyerEmail}
                      </p>
                      <p className="text-xs text-ink-muted">{new Date(order.placedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-sm font-medium text-ink">
                      {order.currency} {order.totalAmount}
                    </p>
                    <Badge tone={statusTone[order.status]}>{order.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DashCardFooter className="justify-start">
            <Link href={`/stores/${params.storeId}/orders`}>
              <Button size="sm" variant="ghost">
                View all orders
              </Button>
            </Link>
          </DashCardFooter>
        </DashCard>

        <DashCard>
          <DashCardHeader title="Needs attention" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted">
              <Clock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                {pendingOrders} order{pendingOrders === 1 ? "" : "s"} awaiting payment
              </p>
              <p className="text-xs text-ink-muted">{products.length} product{products.length === 1 ? "" : "s"} live</p>
            </div>
          </div>
          <DashCardFooter className="justify-start">
            <Link href={`/stores/${params.storeId}/orders`}>
              <Button size="sm" variant="ghost">
                View orders
              </Button>
            </Link>
            <Link href={`/stores/${params.storeId}/products`}>
              <Button size="sm" variant="ghost">
                View products
              </Button>
            </Link>
          </DashCardFooter>
        </DashCard>
      </div>
    </div>
  );
}
