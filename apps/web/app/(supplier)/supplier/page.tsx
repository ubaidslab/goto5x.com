"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface StoreLink {
  id: string;
  storeId: string;
  status: string;
  store: { id: string; name: string; slug: string };
}

interface OrderItem {
  id: string;
  storeId: string;
  quantity: number;
  unitPrice: string;
  fulfillmentStatus: string;
  order: { id: string; buyerEmail: string } | null;
}

interface Plan {
  id: string;
  name: string;
  tierOrder: number;
  price: string;
  currency: string;
}

interface Subscription {
  planId: string;
  plan: Plan;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  createdAt: string;
  label: string;
}
interface WalletTransactionPage {
  items: WalletTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Module 20 (SRS FR-7.10) - the supplier-facing portal that never existed
 * in apps/web before this module: linked stores, fulfillment queue (per-
 * store on Free, unified cross-store on Premium), plan status, and the
 * supplier's own small wallet. Bare-but-styled (reuses the seller
 * dashboard's UI kit), first version of this surface.
 */
export default function SupplierDashboardPage() {
  const [links, setLinks] = useState<StoreLink[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [plans, setPlans] = useState<{ supplier: Plan[] } | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionPage | null>(null);
  const [transactionsPage, setTransactionsPage] = useState(1);

  function loadAll() {
    api.get<StoreLink[]>("/supplier/store-links").then(setLinks).catch(() => setLinks([]));
    api.get<Subscription>("/suppliers/me/subscription").then(setSubscription).catch(() => {});
    api.get<{ balance: number }>("/suppliers/me/wallet").then((r) => setBalance(r.balance)).catch(() => {});
    api.get<{ supplier: Plan[] }>("/plans").then(setPlans).catch(() => {});
  }

  useEffect(loadAll, []);

  useEffect(() => {
    api
      .get<WalletTransactionPage>(`/suppliers/me/wallet/transactions?page=${transactionsPage}&limit=20`)
      .then(setTransactions)
      .catch(() => setTransactions(null));
  }, [transactionsPage]);

  function loadItems(storeId?: string) {
    setItemsError(null);
    const query = storeId ? `?storeId=${storeId}` : "";
    api
      .get<OrderItem[]>(`/supplier/orders${query}`)
      .then(setItems)
      .catch((err) => {
        setItems(null);
        setItemsError(err instanceof ApiError ? err.message : "Could not load orders.");
      });
  }

  useEffect(() => {
    if (links) loadItems(selectedStoreId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, selectedStoreId]);

  async function upgrade(planId: string) {
    await api.post("/suppliers/me/subscription/change", { planId });
    loadAll();
  }

  if (links === null || plans === null) return <PageSpinner />;

  const isPremium = subscription?.plan.tierOrder === 1;
  const premiumPlan = plans.supplier.find((p) => p.tierOrder === 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier dashboard"
        description="Every order you fulfill, across every store you're connected to."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">Plan</p>
            <p className="mt-1 text-lg font-semibold text-ink">{subscription?.plan.name ?? "Loading..."}</p>
            {!isPremium && premiumPlan && (
              <Button size="sm" className="mt-3" onClick={() => upgrade(premiumPlan.id)}>
                Upgrade to {premiumPlan.name} ({premiumPlan.currency} {premiumPlan.price}/mo)
              </Button>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">Wallet balance</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {balance === null ? "Loading..." : `Rs. ${balance.toFixed(2)}`}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Wallet transaction history" />
        <CardBody>
          {!transactions ? (
            <p className="py-4 text-sm text-ink-muted">Loading...</p>
          ) : transactions.items.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">No transactions yet.</p>
          ) : (
            <>
              <div className="divide-y divide-border">
                {transactions.items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-ink-muted">{new Date(t.createdAt).toLocaleString()}</span>
                    <span className="flex-1 px-2 text-ink">{t.label}</span>
                    <span className={`font-medium tabular-nums ${t.amount < 0 ? "text-danger" : "text-success"}`}>
                      {t.amount < 0 ? "-" : "+"}Rs. {Math.abs(t.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              {transactions.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={transactions.page <= 1}
                    onClick={() => setTransactionsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-ink-muted">
                    Page {transactions.page} of {transactions.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={transactions.page >= transactions.totalPages}
                    onClick={() => setTransactionsPage((p) => Math.min(transactions.totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Connected stores" />
        <CardBody className="divide-y divide-border">
          {links.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">Not connected to any store yet.</p>
          ) : (
            links.map((link) => (
              <div key={link.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-ink">{link.store.name}</p>
                <Badge tone={link.status === "active" ? "success" : "neutral"}>{link.status}</Badge>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={isPremium ? "All orders (aggregated)" : "Orders"} />
        <CardBody>
          {!isPremium && links.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" variant={selectedStoreId === "" ? "primary" : "secondary"} onClick={() => setSelectedStoreId("")}>
                All (Premium only)
              </Button>
              {links.map((link) => (
                <Button
                  key={link.storeId}
                  size="sm"
                  variant={selectedStoreId === link.storeId ? "primary" : "secondary"}
                  onClick={() => setSelectedStoreId(link.storeId)}
                >
                  {link.store.name}
                </Button>
              ))}
            </div>
          )}
          {itemsError && <Alert>{itemsError}</Alert>}
          {items && (
            <div className="divide-y divide-border">
              {items.length === 0 ? (
                <p className="py-4 text-sm text-ink-muted">No order items yet.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-ink">Qty {item.quantity} - Rs. {item.unitPrice}</p>
                      <p className="text-xs text-ink-muted">{item.order?.buyerEmail ?? "-"}</p>
                    </div>
                    <Badge tone="neutral">{item.fulfillmentStatus}</Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
