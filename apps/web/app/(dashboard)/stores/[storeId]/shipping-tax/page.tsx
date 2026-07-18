"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface ShippingSettings {
  flatRate: string;
  freeShippingThreshold: string | null;
}
interface TaxSettings {
  taxRate: string;
  taxInclusive: boolean;
  taxLabel: string;
}

export default function ShippingTaxPage({ params }: { params: { storeId: string } }) {
  const [shipping, setShipping] = useState<ShippingSettings | null>(null);
  const [tax, setTax] = useState<TaxSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingShipping, setSavingShipping] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    api.get<ShippingSettings>(`/stores/${params.storeId}/shipping-settings`).then(setShipping).catch(() => setShipping(null));
    api.get<TaxSettings>(`/stores/${params.storeId}/tax-settings`).then(setTax).catch(() => setTax(null));
  }, [params.storeId]);

  if (!shipping || !tax) return <PageSpinner />;

  async function saveShipping(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavingShipping(true);
    const form = new FormData(e.currentTarget);
    const freeShippingThreshold = form.get("freeShippingThreshold") as string;
    try {
      const updated = await api.patch<ShippingSettings>(`/stores/${params.storeId}/shipping-settings`, {
        flatRate: Number(form.get("flatRate")),
        freeShippingThreshold: freeShippingThreshold ? Number(freeShippingThreshold) : null,
      });
      setShipping(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save shipping settings.");
    } finally {
      setSavingShipping(false);
    }
  }

  async function saveTax(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavingTax(true);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.patch<TaxSettings>(`/stores/${params.storeId}/tax-settings`, {
        taxRate: Number(form.get("taxRate")),
        taxLabel: form.get("taxLabel") as string,
        taxInclusive: form.get("taxInclusive") === "on",
      });
      setTax(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save tax settings.");
    } finally {
      setSavingTax(false);
    }
  }

  return (
    <div>
      <PageHeader title="Shipping & tax" description="Applied to every order at checkout." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Shipping" description="One flat rate for every order, with an optional free-shipping threshold." />
          <CardBody>
            <form onSubmit={saveShipping} className="space-y-4">
              <Field label="Flat shipping rate" hint="Charged on every order, in your store's currency.">
                <Input name="flatRate" type="number" step="0.01" min="0" defaultValue={shipping.flatRate} required />
              </Field>
              <Field
                label="Free shipping threshold"
                hint="Orders at or above this subtotal ship free. Leave blank to disable."
              >
                <Input name="freeShippingThreshold" type="number" step="0.01" min="0" defaultValue={shipping.freeShippingThreshold ?? ""} />
              </Field>
              <Button type="submit" loading={savingShipping}>
                Save shipping
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tax" description="One tax rate applied storewide." />
          <CardBody>
            <form onSubmit={saveTax} className="space-y-4">
              <Field label="Tax rate (%)">
                <Input name="taxRate" type="number" step="0.01" min="0" max="100" defaultValue={tax.taxRate} required />
              </Field>
              <Field label="Tax label" hint="Shown to buyers on their order summary, e.g. GST or Sales Tax.">
                <Input name="taxLabel" maxLength={40} defaultValue={tax.taxLabel} required />
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="taxInclusive" defaultChecked={tax.taxInclusive} />
                Prices already include tax
              </label>
              <Button type="submit" loading={savingTax}>
                Save tax
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
