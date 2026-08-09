"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
  label: string;
}

interface TransactionPage {
  items: Transaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TopUpRequest {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "verified" | "rejected";
  requestedAt: string;
}

const PRESETS = [500, 1000, 2500, 5000];

/**
 * Module 20 (SRS §5.6e, FR-6.27) - the wallet's Balance/top-up/history
 * screen: everything a seller needs to see where their money went and how
 * to keep the store accepting orders, in plain language.
 */
export default function WalletPage({ params }: { params: { storeId: string } }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactionPage, setTransactionPage] = useState<TransactionPage | null>(null);
  const [page, setPage] = useState(1);
  const [topUps, setTopUps] = useState<TopUpRequest[] | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [instructions, setInstructions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  function loadBalanceAndTopUps() {
    api.get<{ balance: number }>("/sellers/me/wallet").then((r) => setBalance(r.balance)).catch(() => {});
    api.get<TopUpRequest[]>("/sellers/me/wallet/topup-requests").then(setTopUps).catch(() => setTopUps([]));
  }

  useEffect(loadBalanceAndTopUps, []);
  useEffect(() => {
    api
      .get<TransactionPage>(`/sellers/me/wallet/transactions?page=${page}&limit=20`)
      .then(setTransactionPage)
      .catch(() => setTransactionPage({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 }));
  }, [page]);

  async function requestTopUp(value: number) {
    setError(null);
    setInstructions(null);
    setRequesting(true);
    try {
      const result = await api.post<{ instructions: string }>("/sellers/me/wallet/topup-requests", { amount: value });
      setInstructions(result.instructions);
      setAmount("");
      loadBalanceAndTopUps();
      if (page === 1) {
        api
          .get<TransactionPage>("/sellers/me/wallet/transactions?page=1&limit=20")
          .then(setTransactionPage)
          .catch(() => {});
      } else {
        setPage(1);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit that top-up request.");
    } finally {
      setRequesting(false);
    }
  }

  if (balance === null || transactionPage === null || topUps === null) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        description="Top up your wallet to publish your store and cover commission - no online gateway, just a simple bank transfer an admin verifies."
      />

      <Card>
        <CardBody>
          <p className="text-sm text-ink-muted">Balance</p>
          <p className="mt-1 text-4xl font-semibold text-ink">Rs. {balance.toFixed(2)}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Top up" />
        <CardBody className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {instructions && <Alert tone="info">{instructions}</Alert>}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button key={preset} variant="secondary" size="sm" loading={requesting} onClick={() => requestTopUp(preset)}>
                Rs. {preset}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="max-w-[180px]">
              <Field label="Custom amount" htmlFor="custom-amount">
                <Input
                  id="custom-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1500"
                />
              </Field>
            </div>
            <Button
              loading={requesting}
              disabled={!amount || Number(amount) <= 0}
              onClick={() => requestTopUp(Number(amount))}
            >
              Request top-up
            </Button>
          </div>
        </CardBody>
      </Card>

      {topUps.length > 0 && (
        <Card>
          <CardHeader title="Top-up requests" />
          <CardBody className="divide-y divide-border">
            {topUps.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-ink">Rs. {Number(t.amount).toFixed(2)}</p>
                  <p className="text-xs text-ink-muted">{new Date(t.requestedAt).toLocaleString()}</p>
                </div>
                <Badge tone={t.status === "verified" ? "success" : t.status === "rejected" ? "danger" : "warning"}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Transaction history" description={transactionPage.total > 0 ? `${transactionPage.total} total` : undefined} />
        <CardBody className="divide-y divide-border">
          {transactionPage.items.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">No wallet activity yet.</p>
          ) : (
            transactionPage.items.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-ink">{t.label}</p>
                  <p className="text-xs text-ink-muted">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <p className={`text-sm font-semibold ${t.amount >= 0 ? "text-success" : "text-ink"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount.toFixed(2)} {t.currency}
                </p>
              </div>
            ))
          )}
        </CardBody>
        {transactionPage.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={transactionPage.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <p className="text-xs text-ink-muted">
              Page {transactionPage.page} of {transactionPage.totalPages}
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={transactionPage.page >= transactionPage.totalPages}
              onClick={() => setPage((p) => Math.min(transactionPage.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
