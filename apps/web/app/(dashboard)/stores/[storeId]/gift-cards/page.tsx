"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type GiftCardStatus = "pending_payment" | "active" | "depleted" | "expired" | "cancelled";
type GiftCardSource = "buyer_purchase" | "seller_issued";

interface GiftCard {
  id: string;
  code: string;
  source: GiftCardSource;
  status: GiftCardStatus;
  initialValue: string;
  remainingBalance: string;
  currency: string;
  purchaserEmail: string | null;
  issuedNote: string | null;
  createdAt: string;
}

const statusTone: Record<GiftCardStatus, "neutral" | "success" | "warning" | "danger"> = {
  pending_payment: "warning",
  active: "success",
  depleted: "neutral",
  expired: "neutral",
  cancelled: "danger",
};

export default function GiftCardsPage({ params }: { params: { storeId: string } }) {
  const [cards, setCards] = useState<GiftCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function load() {
    api
      .get<GiftCard[]>(`/stores/${params.storeId}/gift-cards`)
      .then(setCards)
      .catch(() => setCards([]));
  }

  useEffect(load, [params.storeId]);

  async function issue() {
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/stores/${params.storeId}/gift-cards`, {
        amount: value,
        code: code.trim() || undefined,
        note: note.trim() || undefined,
      });
      setAmount("");
      setCode("");
      setNote("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't issue gift card.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPaid(giftCardId: string) {
    setError(null);
    setConfirmingId(giftCardId);
    try {
      await api.post(`/stores/${params.storeId}/gift-cards/${giftCardId}/confirm-paid`, {});
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't confirm payment.");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Gift Cards"
        description="Store gift cards - purchased by buyers or issued directly by you (e.g. goodwill credit) - redeemable at checkout."
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <Card className="mb-6 p-6">
        <p className="mb-3 text-sm font-medium text-ink">Issue a gift card</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Amount">
            <input
              type="number"
              min={0}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Code (optional)">
            <input
              type="text"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Auto-generated if left blank"
            />
          </Field>
          <Field label="Note (optional)">
            <input
              type="text"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Goodwill credit"
            />
          </Field>
        </div>
        <Button className="mt-3" loading={submitting} onClick={issue}>
          Issue gift card
        </Button>
      </Card>

      {cards === null ? (
        <PageSpinner />
      ) : cards.length === 0 ? (
        <Card>
          <EmptyState title="No gift cards yet" description="Issue one above, or wait for a buyer to purchase one from your storefront." />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {cards.map((card) => (
            <div key={card.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-ink">{card.code}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {card.source === "buyer_purchase" ? `Purchased by ${card.purchaserEmail ?? "unknown"}` : card.issuedNote || "Seller-issued"}
                  {" · "}
                  {new Date(card.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink">
                  {card.currency} {card.remainingBalance} / {card.initialValue}
                </span>
                <Badge tone={statusTone[card.status]}>{card.status.replace("_", " ")}</Badge>
                {card.status === "pending_payment" && (
                  <Button size="sm" loading={confirmingId === card.id} onClick={() => confirmPaid(card.id)}>
                    Confirm payment received
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
