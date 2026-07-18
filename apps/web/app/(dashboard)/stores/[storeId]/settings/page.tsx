"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type AccessMode = "public" | "coming_soon" | "password_protected";

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

interface SellerProfile {
  dashboardTheme: string;
  cnicMasked: string | null;
  activationStatus: "auto_approved" | "pending_review" | "blocked";
}

const DASHBOARD_THEMES: { id: string; label: string; swatch: string }[] = [
  { id: "default", label: "Indigo (default)", swatch: "#5b5fef" },
  { id: "emerald", label: "Emerald", swatch: "#1f9254" },
  { id: "amber", label: "Amber", swatch: "#b5750a" },
  { id: "rose", label: "Rose", swatch: "#c23b6b" },
];

export default function StoreSettingsPage({ params }: { params: { storeId: string } }) {
  const [accessMode, setAccessMode] = useState<AccessMode>("public");
  const [accessPassword, setAccessPassword] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [dashboardTheme, setDashboardTheme] = useState("default");
  const [savingTheme, setSavingTheme] = useState(false);

  const [payment, setPayment] = useState<PaymentInstructions | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);

  const [cnicMasked, setCnicMasked] = useState<string | null>(null);
  const [activationStatus, setActivationStatus] = useState<SellerProfile["activationStatus"]>("auto_approved");
  const [cnicInput, setCnicInput] = useState("");
  const [savingCnic, setSavingCnic] = useState(false);
  const [cnicSaved, setCnicSaved] = useState(false);

  useEffect(() => {
    api
      .get<{ accessMode: AccessMode }>(`/stores/${params.storeId}`)
      .then((s) => setAccessMode(s.accessMode))
      .finally(() => setLoaded(true));
    api
      .get<SellerProfile>("/sellers/me")
      .then((profile) => {
        setDashboardTheme(profile.dashboardTheme);
        setCnicMasked(profile.cnicMasked);
        setActivationStatus(profile.activationStatus);
      })
      .catch(() => {});
    api
      .get<PaymentInstructions>(`/stores/${params.storeId}/payment-instructions`)
      .then(setPayment)
      .catch(() => {});
  }, [params.storeId]);

  if (!loaded) return <PageSpinner />;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.patch(`/stores/${params.storeId}`, {
        accessMode,
        ...(accessPassword ? { accessPassword } : {}),
      });
      setAccessPassword("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save store settings.");
    } finally {
      setSaving(false);
    }
  }

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

  async function saveCnic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCnicSaved(false);
    setSavingCnic(true);
    try {
      const result = await api.patch<{ cnicMasked: string }>("/sellers/me/cnic", { cnic: cnicInput });
      setCnicMasked(result.cnicMasked);
      setCnicInput("");
      setCnicSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save CNIC.");
    } finally {
      setSavingCnic(false);
    }
  }

  async function chooseTheme(themeId: string) {
    setSavingTheme(true);
    try {
      await api.patch("/sellers/me/dashboard-theme", { dashboardTheme: themeId });
      setDashboardTheme(themeId);
      window.location.reload(); // simplest way to repaint the whole shell with the new data-attribute
    } catch {
      setSavingTheme(false);
    }
  }

  return (
    <div>
      <PageHeader title="Store settings" />

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Storefront access" description="Who can view your storefront right now." />
          <CardBody>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                {(["public", "coming_soon", "password_protected"] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm text-ink">
                    <input type="radio" checked={accessMode === mode} onChange={() => setAccessMode(mode)} />
                    {mode === "public" ? "Public" : mode === "coming_soon" ? "Coming soon" : "Password-protected"}
                  </label>
                ))}
              </div>
              {accessMode === "password_protected" && (
                <Input
                  type="password"
                  placeholder="Set/change password"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                />
              )}
              <Button type="submit" loading={saving}>
                Save
              </Button>
            </form>
          </CardBody>
        </Card>

        {payment && (
          <Card>
            <CardHeader
              title="Payment instructions"
              description="How buyers pay you. Shown at checkout and on their order confirmation - you'll mark each order paid yourself once you've received it."
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
        )}

        <Card>
          <CardHeader
            title="Identity verification"
            description="Required before checkout works - a way for the platform to confirm the seller behind an account is a real, accountable person."
          />
          <CardBody>
            {activationStatus !== "auto_approved" && (
              <Alert tone="info">
                Your account is under review ({activationStatus === "blocked" ? "blocked pending review" : "pending review"}).
                You can keep using your dashboard while an admin looks at it.
              </Alert>
            )}
            {cnicMasked ? (
              <p className="mb-4 text-sm text-ink">
                CNIC on file: <span className="font-medium">{cnicMasked}</span>
              </p>
            ) : (
              <p className="mb-4 text-sm text-ink-muted">No CNIC on file yet - required before checkout works.</p>
            )}
            <form onSubmit={saveCnic} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={cnicMasked ? "Update CNIC" : "CNIC"}>
                  <Input
                    placeholder="XXXXX-XXXXXXX-X"
                    value={cnicInput}
                    onChange={(e) => setCnicInput(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Button type="submit" loading={savingCnic}>
                Save
              </Button>
            </form>
            {cnicSaved && <Alert tone="success">Saved.</Alert>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Dashboard appearance" description="Purely cosmetic - only changes how your own dashboard looks, never your storefront." />
          <CardBody>
            <div className="flex gap-3">
              {DASHBOARD_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  disabled={savingTheme}
                  onClick={() => chooseTheme(theme.id)}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 transition-smooth-fast disabled:opacity-50 ${
                    dashboardTheme === theme.id ? "border-accent" : "border-border hover:border-border-strong"
                  }`}
                >
                  <span className="h-8 w-8 rounded-full" style={{ backgroundColor: theme.swatch }} />
                  <span className="text-xs text-ink-muted">{theme.label}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
