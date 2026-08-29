"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface DealItem {
  id: string;
  productId: string;
  variantId: string;
  product: { title: string };
  variant: { sku: string; price: string };
}
interface Deal {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  discountPercent: string;
  status: "draft" | "active" | "archived";
  items: DealItem[];
}

const statusTone = { active: "success", draft: "neutral", archived: "neutral" } as const;

/** SRS §5.67/FR-67.4 - edit fields, toggle status, and remove bundled items (adding more reuses the same item picker as deals/new). */
export default function DealDetailPage({ params }: { params: { storeId: string; dealId: string } }) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [status, setStatus] = useState<Deal["status"]>("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  function refresh() {
    api
      .get<Deal>(`/stores/${params.storeId}/deals/${params.dealId}`)
      .then((d) => {
        setDeal(d);
        setTitle(d.title);
        setDescription(d.description ?? "");
        setDiscountPercent(d.discountPercent);
        setStatus(d.status);
      })
      .catch(() => setDeal(null));
  }

  useEffect(refresh, [params.storeId, params.dealId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/stores/${params.storeId}/deals/${params.dealId}`, {
        title,
        description: description || undefined,
        discountPercent: Number(discountPercent),
        status,
      });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this deal.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(dealItemId: string) {
    setRemovingItemId(dealItemId);
    try {
      await api.delete(`/stores/${params.storeId}/deals/${params.dealId}/items/${dealItemId}`);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that item.");
    } finally {
      setRemovingItemId(null);
    }
  }

  if (deal === null) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title={deal.title}
        description="Bundle products together at one uniform percentage off."
        action={<Badge tone={statusTone[deal.status]}>{deal.status}</Badge>}
      />

      <Link href={`/stores/${params.storeId}/deals`} className="mb-4 inline-block text-sm text-ink-muted hover:text-ink">
        &larr; Back to Deals
      </Link>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Deal details" />
          <CardBody>
            <form onSubmit={onSave} className="space-y-4">
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Description (optional)">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </Field>
              <Field label="Discount percent">
                <Input type="number" min={1} max={100} step="0.01" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} required />
              </Field>
              <Field label="Status" hint="Active deals are the only ones visible on your storefront.">
                <Select value={status} onChange={(e) => setStatus(e.target.value as Deal["status"])}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Items" description={`${deal.items.length} item${deal.items.length === 1 ? "" : "s"} in this deal.`} />
          <CardBody className="space-y-2">
            {deal.items.length === 0 ? (
              <p className="text-sm text-ink-muted">This deal has no items - add some or it can't be purchased.</p>
            ) : (
              deal.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.product.title}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {item.variant.sku} - Rs {item.variant.price}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" loading={removingItemId === item.id} onClick={() => removeItem(item.id)}>
                    Remove
                  </Button>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
