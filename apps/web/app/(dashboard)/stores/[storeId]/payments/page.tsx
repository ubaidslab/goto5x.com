"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { ApiError, api } from "@/lib/dashboard-api";

interface PaymentInstructions {
  bankAccountTitle: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  jazzcashNumber: string | null;
  jazzcashAccountTitle: string | null;
  easypaisaNumber: string | null;
  easypaisaAccountTitle: string | null;
  nameDeclaredSelfOwned: boolean;
  nameConsistencyStatus: "not_required" | "pending" | "approved" | "rejected";
  codEnabled: boolean;
}

type PaymentGatewayProvider = "raast" | "easypaisa" | "jazzcash" | "bank";

// Module 62 (SRS §5.6h, FR-6.36) - never includes the encrypted credential
// fields (backend SAFE_SELECT allowlist); write-only credentials, same
// pattern FR-30.1's CNIC entry already uses.
interface PaymentGatewayConnection {
  provider: PaymentGatewayProvider;
  merchantId: string | null;
  isActive: boolean;
  priorityOrder: number;
  connectedAt: string;
}

const GATEWAY_PROVIDER_LABELS: Record<PaymentGatewayProvider, string> = {
  raast: "Raast",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  bank: "Bank transfer",
};

// Placeholder guidance, not a provider-accurate integration guide - the
// connect form itself is one generic field set for all four providers
// today (docs/ui-feature-inventory.md §11's disclosed gap). This at least
// points a seller at the right credential to go find, per provider.
const GATEWAY_PROVIDER_HINT: Record<PaymentGatewayProvider, string> = {
  raast: "Free, and offered first to buyers at checkout. Use the API key from your bank's Raast merchant dashboard.",
  easypaisa: "Use the Store ID as your Merchant ID and your Easypaisa merchant API key.",
  jazzcash: "Use your JazzCash Merchant ID and the API key/password from your JazzCash merchant portal.",
  bank: "For manual bank-transfer verification - use any reference key your bank/aggregator issued you, if you have one.",
};

/**
 * Phase 5f (founder directive, docs/ui-feature-inventory.md §11) - extracted
 * out of the monolithic Settings page into its own route so `nav-items.ts`'s
 * "Operations -> Payments" link goes somewhere real instead of a same-page
 * anchor. Copy reframed around order-verification (never commission - there
 * isn't one under the subscription-only model): a seller connects their own
 * gateway "so we can verify your buyer's payment was received and confirm
 * the order automatically."
 */
export default function PaymentsPage({ params }: { params: { storeId: string } }) {
  const [payment, setPayment] = useState<PaymentInstructions | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gatewayConnections, setGatewayConnections] = useState<PaymentGatewayConnection[] | null>(null);
  const [gatewayProvider, setGatewayProvider] = useState<PaymentGatewayProvider>("raast");
  const [gatewayMerchantId, setGatewayMerchantId] = useState("");
  const [gatewayApiKey, setGatewayApiKey] = useState("");
  const [gatewayApiSecret, setGatewayApiSecret] = useState("");
  const [connectingGateway, setConnectingGateway] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [gatewayTestResults, setGatewayTestResults] = useState<Record<string, boolean>>({});
  const [testingGateway, setTestingGateway] = useState<string | null>(null);
  const [togglingGateway, setTogglingGateway] = useState<string | null>(null);
  const [removingGateway, setRemovingGateway] = useState<string | null>(null);

  function loadGatewayConnections() {
    api
      .get<PaymentGatewayConnection[]>(`/stores/${params.storeId}/payment-gateway`)
      .then(setGatewayConnections)
      .catch(() => setGatewayConnections([]));
  }

  useEffect(() => {
    api
      .get<PaymentInstructions>(`/stores/${params.storeId}/payment-instructions`)
      .then(setPayment)
      .catch(() => {});
    loadGatewayConnections();
  }, [params.storeId]);

  async function savePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPaymentSaved(false);
    setSavingPayment(true);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.patch<PaymentInstructions>(`/stores/${params.storeId}/payment-instructions`, {
        bankAccountTitle: (form.get("bankAccountTitle") as string) || undefined,
        bankAccountNumber: (form.get("bankAccountNumber") as string) || undefined,
        bankName: (form.get("bankName") as string) || undefined,
        jazzcashNumber: (form.get("jazzcashNumber") as string) || undefined,
        jazzcashAccountTitle: (form.get("jazzcashAccountTitle") as string) || undefined,
        easypaisaNumber: (form.get("easypaisaNumber") as string) || undefined,
        easypaisaAccountTitle: (form.get("easypaisaAccountTitle") as string) || undefined,
        nameDeclaredSelfOwned: form.get("nameDeclaredSelfOwned") === "on",
        codEnabled: form.get("codEnabled") === "on",
      });
      setPayment(updated);
      setPaymentSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save payment instructions.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function connectGateway(e: React.FormEvent) {
    e.preventDefault();
    setGatewayError(null);
    setConnectingGateway(true);
    try {
      await api.post(`/stores/${params.storeId}/payment-gateway`, {
        provider: gatewayProvider,
        merchantId: gatewayMerchantId || undefined,
        apiKey: gatewayApiKey,
        apiSecret: gatewayApiSecret || undefined,
      });
      setGatewayMerchantId("");
      setGatewayApiKey("");
      setGatewayApiSecret("");
      loadGatewayConnections();
    } catch (err) {
      setGatewayError(err instanceof ApiError ? err.message : "Couldn't connect that gateway.");
    } finally {
      setConnectingGateway(false);
    }
  }

  async function setGatewayActive(provider: PaymentGatewayProvider, isActive: boolean) {
    setGatewayError(null);
    setTogglingGateway(provider);
    try {
      await api.patch(`/stores/${params.storeId}/payment-gateway/${provider}/active`, { isActive });
      loadGatewayConnections();
    } catch (err) {
      setGatewayError(err instanceof ApiError ? err.message : "Couldn't update that connection.");
    } finally {
      setTogglingGateway(null);
    }
  }

  async function testGatewayConnection(provider: PaymentGatewayProvider) {
    setGatewayError(null);
    setTestingGateway(provider);
    try {
      const result = await api.post<{ success: boolean }>(`/stores/${params.storeId}/payment-gateway/${provider}/test`);
      setGatewayTestResults((prev) => ({ ...prev, [provider]: result.success }));
    } catch (err) {
      setGatewayError(err instanceof ApiError ? err.message : "Couldn't test that connection.");
    } finally {
      setTestingGateway(null);
    }
  }

  async function removeGatewayConnection(provider: PaymentGatewayProvider) {
    setGatewayError(null);
    setRemovingGateway(provider);
    try {
      await api.delete(`/stores/${params.storeId}/payment-gateway/${provider}`);
      loadGatewayConnections();
    } catch (err) {
      setGatewayError(err instanceof ApiError ? err.message : "Couldn't remove that connection.");
    } finally {
      setRemovingGateway(null);
    }
  }

  if (!payment || !gatewayConnections) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Payments" description="How buyers pay you, and how those payments get verified." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader
            title="Payment gateway"
            description="Connect your own Raast, Easypaisa, JazzCash, or bank account so we can verify your buyer's payment was received and confirm the order automatically - your money never passes through UZEYN, and there's no commission either way. Raast is free and offered first at checkout. Sellers without a connection keep using the manual payment instructions below."
          />
          <CardBody>
            {gatewayError && <Alert>{gatewayError}</Alert>}
            {gatewayConnections.length > 0 && (
              <Reveal className="mb-4 divide-y divide-border overflow-hidden rounded-lg border border-border" stagger={0.04}>
                {gatewayConnections.map((c) => (
                  <div key={c.provider} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{GATEWAY_PROVIDER_LABELS[c.provider]}</p>
                      <p className="text-xs text-ink-muted">
                        {c.merchantId ? `Merchant ID: ${c.merchantId}` : "No merchant ID set"}
                        {gatewayTestResults[c.provider] !== undefined &&
                          (gatewayTestResults[c.provider] ? " · Test: OK" : " · Test: failed")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-ink">
                        <input
                          type="checkbox"
                          checked={c.isActive}
                          disabled={togglingGateway === c.provider}
                          onChange={(e) => setGatewayActive(c.provider, e.target.checked)}
                        />
                        Active
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={testingGateway === c.provider}
                        disabled={togglingGateway === c.provider || removingGateway === c.provider}
                        onClick={() => testGatewayConnection(c.provider)}
                      >
                        Test
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={removingGateway === c.provider}
                        disabled={testingGateway === c.provider || togglingGateway === c.provider}
                        onClick={() => removeGatewayConnection(c.provider)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </Reveal>
            )}
            <form onSubmit={connectGateway} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Provider">
                  <Select
                    value={gatewayProvider}
                    onChange={(e) => setGatewayProvider(e.target.value as PaymentGatewayProvider)}
                  >
                    <option value="raast">Raast</option>
                    <option value="easypaisa">Easypaisa</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="bank">Bank transfer</option>
                  </Select>
                </Field>
                <Field label="Merchant ID" hint="Optional - as issued by the provider.">
                  <Input value={gatewayMerchantId} onChange={(e) => setGatewayMerchantId(e.target.value)} />
                </Field>
              </div>
              <p className="text-xs text-ink-muted">{GATEWAY_PROVIDER_HINT[gatewayProvider]}</p>
              <Field label="API key" hint="Write-only - never shown again once saved.">
                <Input
                  type="password"
                  value={gatewayApiKey}
                  onChange={(e) => setGatewayApiKey(e.target.value)}
                  required
                />
              </Field>
              <Field label="API secret" hint="Optional, provider-dependent.">
                <Input type="password" value={gatewayApiSecret} onChange={(e) => setGatewayApiSecret(e.target.value)} />
              </Field>
              <Button type="submit" loading={connectingGateway}>
                Connect
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Payment instructions"
            description="How buyers pay you when there's no connected gateway. Shown at checkout and on their order confirmation - you'll mark each order paid yourself once you've received it."
          />
          <CardBody>
            <form onSubmit={savePayment} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Bank account title">
                  <Input name="bankAccountTitle" defaultValue={payment.bankAccountTitle ?? ""} />
                </Field>
                <Field label="Bank account number / IBAN">
                  <Input name="bankAccountNumber" defaultValue={payment.bankAccountNumber ?? ""} />
                </Field>
                <Field label="Bank name">
                  <Input name="bankName" defaultValue={payment.bankName ?? ""} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="JazzCash number">
                  <Input name="jazzcashNumber" defaultValue={payment.jazzcashNumber ?? ""} />
                </Field>
                <Field label="JazzCash account title">
                  <Input name="jazzcashAccountTitle" defaultValue={payment.jazzcashAccountTitle ?? ""} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Easypaisa number">
                  <Input name="easypaisaNumber" defaultValue={payment.easypaisaNumber ?? ""} />
                </Field>
                <Field label="Easypaisa account title">
                  <Input name="easypaisaAccountTitle" defaultValue={payment.easypaisaAccountTitle ?? ""} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="nameDeclaredSelfOwned" defaultChecked={payment.nameDeclaredSelfOwned} />
                Each account above is registered in my own legal name
              </label>
              {payment.nameConsistencyStatus === "pending" && (
                <Alert tone="info">
                  One of your declared account titles doesn&apos;t clearly match your business name - an admin will
                  review it. You can keep using your dashboard normally in the meantime.
                </Alert>
              )}
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="codEnabled" defaultChecked={payment.codEnabled} />
                Accept Cash on Delivery
              </label>
              {paymentSaved && <Alert tone="success">Saved.</Alert>}
              <Button type="submit" loading={savingPayment}>
                Save payment instructions
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
