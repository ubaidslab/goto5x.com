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
import { GradientMesh } from "@/components/marketing/AbstractGraphic";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { THEME_PRESETS } from "@/lib/theme-presets";
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
  currency: string;
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

interface ThemeOption {
  id: string;
  name: string;
}

/**
 * Founder walkthrough finding (Phase 2 item 13) - "DEFAULT VISUAL QUALITY":
 * replaces the old theme step's "Choose a theme (leaves to the old bare
 * /customizer) / Keep this theme (blind accept)" pair with the real,
 * simplified choice the founder asked for - exactly two premium starting
 * points, Light and Dark, free on every tier. Both option ids and their
 * preset colors are server-resolved (StoreThemeSettingsService.getForStore(),
 * lib/theme-presets.ts's THEME_PRESETS), never hardcoded here, so an admin
 * re-pick of which two built-in templates serve this role needs no
 * frontend change. The full 22-section/14-preset catalog stays fully
 * discoverable afterward inside D-Studio - this is only the first-touch
 * starting point.
 */
function ThemeStartPicker({ storeId, onPicked }: { storeId: string; onPicked: () => void }) {
  const [themeSettings, setThemeSettings] = useState<{ themeId: string; lightId: string; darkId: string } | null>(null);
  const [themes, setThemes] = useState<ThemeOption[] | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ themeId: string; firstTouchLightThemeId: string; firstTouchDarkThemeId: string }>(`/stores/${storeId}/theme-settings`)
      .then((res) => setThemeSettings({ themeId: res.themeId, lightId: res.firstTouchLightThemeId, darkId: res.firstTouchDarkThemeId }))
      .catch(() => setThemeSettings(null));
    api
      .get<ThemeOption[]>("/themes")
      .then(setThemes)
      .catch(() => setThemes([]));
  }, [storeId]);

  async function pick(id: string, choice: "light" | "dark") {
    setPicking(id);
    try {
      // Founder walkthrough finding (Phase 2 item 13) - a dedicated
      // one-time endpoint, not the general theme-settings PATCH: the
      // server resolves the real theme id from the Settings Registry
      // itself, so this can never be replayed as "set themeId=Studio
      // directly" to get free permanent premium access (see
      // StoreThemeSettingsService.pickFirstTouchTheme()'s own comment).
      await api.post(`/stores/${storeId}/theme-settings/first-touch-pick`, { choice });
      onPicked();
    } finally {
      setPicking(null);
    }
  }

  if (!themeSettings || !themes) {
    return <PageSpinner />;
  }

  const options: { id: string; label: string; choice: "light" | "dark" }[] = [
    { id: themeSettings.lightId, label: "Light", choice: "light" },
    { id: themeSettings.darkId, label: "Dark", choice: "dark" },
  ];

  return (
    <div className="flex gap-4">
      {options.map((opt) => {
        const theme = themes.find((t) => t.id === opt.id);
        const preset = theme ? THEME_PRESETS[theme.name] : undefined;
        const isCurrent = themeSettings.themeId === opt.id;
        const bg = preset?.colors.background ?? "#fff";
        const ink = preset?.colors.text ?? "#000";
        const accent = preset?.colors.primary ?? ink;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => pick(opt.id, opt.choice)}
            disabled={picking !== null}
            className={`group flex flex-col items-center gap-2 rounded-lg border p-2.5 transition-smooth-fast disabled:opacity-60 ${
              isCurrent ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong"
            }`}
          >
            {/* Founder walkthrough finding (Phase 4 item 18) - a real
                miniature storefront preview (header bar + product-grid
                blocks in the theme's own colors) rather than a bare "Aa"
                text swatch, so this is an actual visual decision, not a
                label guess. */}
            <span
              className="flex h-16 w-28 flex-col gap-1 overflow-hidden rounded-md p-1.5 shadow-xs transition-transform group-hover:scale-[1.03]"
              style={{ background: bg }}
              aria-hidden
            >
              <span className="h-2 w-8 rounded-full" style={{ background: ink }} />
              <span className="flex flex-1 gap-1">
                <span className="flex-1 rounded-sm" style={{ background: accent, opacity: 0.85 }} />
                <span className="flex-1 rounded-sm" style={{ background: ink, opacity: 0.15 }} />
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-ink">
              {picking === opt.id ? "Saving..." : opt.label}
              {isCurrent && (
                <Badge tone="success" className="text-[10px]">
                  Current
                </Badge>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
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
      label: "Pick a look",
      description: "Start Light or Dark - the full design catalog stays open inside Design Studio.",
      action: progress.theme ? null : <ThemeStartPicker storeId={storeId} onPicked={onAcknowledged} />,
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
    <div className="relative overflow-hidden">
      {/* Founder walkthrough finding (Phase 4 item 18) - this is the very
          first screen a brand-new seller ever sees, and it previously had
          no imagery and no entrance motion at all (unlike the main
          dashboard below, which already had both). Same token-driven
          abstract graphic the marketing homepage's hero uses (never a
          stock photo) - "no visible borders, tonal background" is the
          card mandate, this is a background accent behind it, not a
          replacement for it. */}
      <GradientMesh className="pointer-events-none absolute -top-24 right-0 h-96 w-96 opacity-70" />
      <div className="relative">
        <PageHeader
          title="Get your store ready"
          description={`${doneCount} of ${steps.length} steps done - complete them to finish setting up your store.`}
        />
        <DashCard>
          <DashCardHeader title="Setup checklist" />
          <Reveal className="divide-y divide-border" stagger={0.08}>
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
          </Reveal>
        </DashCard>
      </div>
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
  // Founder walkthrough finding (pre-Milestone-A, Phase 0.4) - this fetch's
  // catch used to be empty, so any real failure (most commonly a fresh
  // install missing Settings Registry rows this endpoint depends on - see
  // src/bootstrap/seed-defaults.ts) left `store` null forever, and the
  // loading gate below rendered `PageSpinner` with no way out. Every other
  // fetch on this page already has a fallback in its own `.catch()` - this
  // was the one exception.
  const [storeError, setStoreError] = useState<string | null>(null);

  function refreshOnboarding() {
    api
      .get<OnboardingProgress>(`/stores/${params.storeId}/onboarding`)
      .then(setOnboarding)
      .catch(() => setOnboarding({ theme: true, logo: true, product: true, domain: true, completedAt: new Date().toISOString() }));
  }

  function refreshStore() {
    api
      .get<StoreSummary>(`/stores/${params.storeId}`)
      .then((s) => {
        setStore(s);
        setStoreError(null);
      })
      .catch((err) => setStoreError(err instanceof ApiError ? err.message : "Couldn't load your store details."));
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

  if (storeError) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Here's what's happening in your store." />
        <Alert tone="danger">
          {storeError}{" "}
          <Button size="sm" variant="outline" onClick={refreshStore}>
            Retry
          </Button>
        </Alert>
      </div>
    );
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
      <div className="relative overflow-hidden">
        <GradientMesh className="pointer-events-none absolute -top-24 right-0 h-96 w-96 opacity-70" />
        <div className="relative">
          <PageHeader title="Welcome to your store" description="Let's get your first product live." />
          <Reveal>
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
          </Reveal>
        </div>
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
      <div className="relative overflow-hidden">
        <GradientMesh className="pointer-events-none absolute -top-24 right-0 h-96 w-96 opacity-70" />
        <div className="relative">
          <PageHeader title="Publish your store" description="One last step before you can accept real orders." />
          <Reveal>
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
          </Reveal>
        </div>
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

      <MilestoneBanner milestone={milestone} currency={store.currency} />

      <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
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
          value={`${store.currency} ${revenueThisPeriod.toLocaleString()}`}
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
          value={`${store.currency} ${Math.round(overview.aov).toLocaleString()}`}
          percent={periodRatio(aovThisPeriod, aovPriorPeriod)}
          hint={periodChangeHint(aovThisPeriod, aovPriorPeriod)}
          isEmpty={!hasSalesHistory}
          emptyMessage="No sales yet"
        />
      </Reveal>

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
            <Reveal className="divide-y divide-border" stagger={0.04}>
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
            </Reveal>
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
