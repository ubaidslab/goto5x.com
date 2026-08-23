"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/dashboard/ConfirmDialogProvider";
import { Reveal } from "@/components/motion/Reveal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface DiscountCode {
  id: string;
  code: string;
  type: "percentage" | "fixed_amount";
  value: string;
  expiresAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
}

export default function DiscountsPage({ params }: { params: { storeId: string } }) {
  const confirm = useConfirm();
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    api
      .get<DiscountCode[]>(`/stores/${params.storeId}/discount-codes`)
      .then(setCodes)
      .catch(() => setCodes([]));
  }

  useEffect(load, [params.storeId]);

  if (!codes) return <PageSpinner />;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const usageLimit = form.get("usageLimit") as string;
    const expiresAt = form.get("expiresAt") as string;
    try {
      await api.post(`/stores/${params.storeId}/discount-codes`, {
        code: (form.get("code") as string).toUpperCase(),
        type: form.get("type"),
        value: Number(form.get("value")),
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that discount code.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(discountCode: DiscountCode) {
    setError(null);
    try {
      const updated = await api.patch<DiscountCode>(`/stores/${params.storeId}/discount-codes/${discountCode.id}`, {
        isActive: !discountCode.isActive,
      });
      setCodes((prev) => prev!.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that discount code.");
    }
  }

  async function remove(id: string, code: string) {
    const ok = await confirm({
      title: `Delete "${code}"?`,
      description: "Buyers will no longer be able to enter this code at checkout. This can't be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await api.delete(`/stores/${params.storeId}/discount-codes/${id}`);
      setCodes((prev) => prev!.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that discount code.");
    }
  }

  return (
    <div>
      <PageHeader title="Discount codes" description="Codes buyers can enter at checkout for a percentage or fixed-amount discount." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Create a discount code" />
          <CardBody>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Code" hint="Letters, numbers, hyphens, and underscores only.">
                <Input name="code" maxLength={40} pattern="[A-Za-z0-9_-]+" required placeholder="e.g. SUMMER10" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type">
                  <Select name="type" defaultValue="percentage">
                    <option value="percentage">Percentage off</option>
                    <option value="fixed_amount">Fixed amount off</option>
                  </Select>
                </Field>
                <Field label="Value">
                  <Input name="value" type="number" step="0.01" min="0" required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Usage limit" hint="Leave blank for unlimited.">
                  <Input name="usageLimit" type="number" min="1" />
                </Field>
                <Field label="Expires" hint="Leave blank to never expire.">
                  <Input name="expiresAt" type="date" />
                </Field>
              </div>
              <Button type="submit" loading={creating}>
                Create code
              </Button>
            </form>
          </CardBody>
        </Card>

        {codes.length === 0 ? (
          <Card>
            <EmptyState title="No discount codes yet" description="Create one above to offer buyers a percentage or fixed-amount discount at checkout." />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            <Reveal stagger={0.04}>
            {codes.map((discountCode) => (
              <div key={discountCode.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{discountCode.code}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {discountCode.type === "percentage" ? `${discountCode.value}% off` : `Rs ${discountCode.value} off`}
                    {discountCode.usageLimit && ` · ${discountCode.usageCount}/${discountCode.usageLimit} used`}
                    {!discountCode.usageLimit && discountCode.usageCount > 0 && ` · ${discountCode.usageCount} used`}
                    {discountCode.expiresAt && ` · expires ${new Date(discountCode.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={discountCode.isActive ? "success" : "neutral"}>{discountCode.isActive ? "active" : "inactive"}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(discountCode)}>
                    {discountCode.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(discountCode.id, discountCode.code)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            </Reveal>
          </Card>
        )}
      </div>
    </div>
  );
}
