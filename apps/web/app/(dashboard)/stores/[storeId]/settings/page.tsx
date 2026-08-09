"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
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
  mfaEnabled: boolean;
  newsletterOptOut: boolean;
}

interface SessionInfo {
  sessionId: string;
  deviceLabel: string;
  ipAddress: string;
  firstSeenAt: string;
  lastActiveAt: string;
}

interface SupportAccessEntry {
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

interface DataExportRow {
  id: string;
  trigger: "subscription_renewal" | "on_demand";
  status: "pending" | "completed" | "failed";
  deliveryMethod: "drive" | "email" | null;
  createdAt: string;
  hasProductsCsv: boolean;
  hasOrdersCsv: boolean;
  hasCustomersCsv: boolean;
  hasInventoryCsv: boolean;
  hasSummaryPdf: boolean;
}

const EXPORT_FILE_LABELS: { file: "products" | "orders" | "customers" | "inventory" | "summary"; label: string; flag: keyof DataExportRow }[] = [
  { file: "products", label: "Products", flag: "hasProductsCsv" },
  { file: "orders", label: "Orders", flag: "hasOrdersCsv" },
  { file: "customers", label: "Customers", flag: "hasCustomersCsv" },
  { file: "inventory", label: "Inventory", flag: "hasInventoryCsv" },
  { file: "summary", label: "Summary", flag: "hasSummaryPdf" },
];

const DASHBOARD_THEMES: { id: string; label: string; swatch: string }[] = [
  { id: "default", label: "Blue (default)", swatch: "#0071e3" },
  { id: "emerald", label: "Emerald", swatch: "#1f9254" },
  { id: "amber", label: "Amber", swatch: "#b5750a" },
  { id: "rose", label: "Rose", swatch: "#c23b6b" },
];

export default function StoreSettingsPage({ params }: { params: { storeId: string } }) {
  const [accessMode, setAccessMode] = useState<AccessMode>("public");
  const [accessPassword, setAccessPassword] = useState("");
  const [policyText, setPolicyText] = useState("");
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [dataExports, setDataExports] = useState<DataExportRow[] | null>(null);
  const [requestingExport, setRequestingExport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);

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

  const [newsletterOptOut, setNewsletterOptOut] = useState(false);
  const [savingNewsletterOptOut, setSavingNewsletterOptOut] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [enrollingMfa, setEnrollingMfa] = useState(false);
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [supportAccessHistory, setSupportAccessHistory] = useState<SupportAccessEntry[] | null>(null);
  const currentSessionId = typeof window !== "undefined" ? localStorage.getItem("sessionId") : null;

  function loadSessions() {
    api
      .get<SessionInfo[]>("/sellers/me/sessions")
      .then(setSessions)
      .catch(() => {});
  }

  function loadDataExports() {
    api
      .get<DataExportRow[]>("/sellers/me/data-export")
      .then(setDataExports)
      .catch(() => setDataExports([]));
  }

  /** Module 24 (SRS §5.36, FR-36.1(b)) - on-demand, rate-limited server-side. */
  async function requestDataExport() {
    setExportError(null);
    setRequestingExport(true);
    try {
      await api.post("/sellers/me/data-export");
      loadDataExports();
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Couldn't request a data export.");
    } finally {
      setRequestingExport(false);
    }
  }

  /**
   * v0.28 security fix - export files contain customer PII and are no
   * longer plain URLs; this streams the bytes through the authenticated
   * download endpoint and triggers the browser's normal save flow via a
   * short-lived blob object URL (revoked immediately after the click).
   */
  async function downloadExportFile(exportId: string, file: string, filename: string) {
    setExportError(null);
    try {
      const blob = await api.download(`/sellers/me/data-export/${exportId}/download/${file}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Couldn't download that file.");
    }
  }

  useEffect(() => {
    api
      .get<{ accessMode: AccessMode; logoUrl: string | null; policyText: string | null }>(`/stores/${params.storeId}`)
      .then((s) => {
        setAccessMode(s.accessMode);
        setLogoUrl(s.logoUrl);
        setPolicyText(s.policyText ?? "");
      })
      .finally(() => setLoaded(true));
    api
      .get<SellerProfile>("/sellers/me")
      .then((profile) => {
        setDashboardTheme(profile.dashboardTheme);
        setCnicMasked(profile.cnicMasked);
        setActivationStatus(profile.activationStatus);
        setMfaEnabled(profile.mfaEnabled);
        setNewsletterOptOut(profile.newsletterOptOut);
      })
      .catch(() => {});
    api
      .get<PaymentInstructions>(`/stores/${params.storeId}/payment-instructions`)
      .then(setPayment)
      .catch(() => {});
    loadDataExports();
    api
      .get<SupportAccessEntry[]>("/sellers/me/support-access-history")
      .then(setSupportAccessHistory)
      .catch(() => {});
    loadSessions();
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

  /** Module 23 (SRS §5.34, FR-34.1) - also the one seller-editable input the Store Health Score's profile-completeness check reads. */
  async function savePolicyText(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPolicySaved(false);
    setSavingPolicy(true);
    try {
      await api.patch(`/stores/${params.storeId}`, { policyText });
      setPolicySaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your store policy.");
    } finally {
      setSavingPolicy(false);
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

  async function beginMfaEnrollment() {
    setError(null);
    setEnrollingMfa(true);
    try {
      const result = await api.post<{ secret: string; otpauthUrl: string }>("/sellers/me/mfa/enroll");
      setMfaSecret(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start 2FA enrollment.");
    } finally {
      setEnrollingMfa(false);
    }
  }

  async function verifyMfaEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifyingMfa(true);
    try {
      await api.post("/sellers/me/mfa/verify", { code: mfaCode });
      setMfaEnabled(true);
      setMfaSecret(null);
      setMfaCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code - try again.");
    } finally {
      setVerifyingMfa(false);
    }
  }

  async function revokeSession(sessionId: string) {
    setError(null);
    try {
      await api.delete(`/sellers/me/sessions/${sessionId}`);
      loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that session.");
    }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.upload<{ logoUrl: string }>(`/stores/${params.storeId}/logo`, formData);
      setLogoUrl(result.logoUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that logo.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function removeLogo() {
    setError(null);
    setRemovingLogo(true);
    try {
      await api.delete(`/stores/${params.storeId}/logo`);
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove the logo.");
    } finally {
      setRemovingLogo(false);
    }
  }

  /** Module 55 (SRS §5.62/FR-62.3) - the same flag a seller can also flip from a newsletter's unsubscribe link. */
  async function toggleNewsletterOptOut() {
    const next = !newsletterOptOut;
    setSavingNewsletterOptOut(true);
    try {
      await api.patch("/sellers/me/newsletter-opt-out", { newsletterOptOut: next });
      setNewsletterOptOut(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that preference.");
    } finally {
      setSavingNewsletterOptOut(false);
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
      <PageHeader
        title="Store settings"
        description="Branding, checkout, and other store-wide preferences."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader
            title="Store branding"
            description="Shown on your storefront header, PDF invoices, and transactional emails. Without a logo, your store name is shown instead."
          />
          <CardBody className="flex items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Store logo" className="h-14 max-w-[200px] rounded-md border border-border object-contain p-1" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-ink-faint">
                No logo
              </div>
            )}
            <div className="flex gap-2">
              <input type="file" accept="image/*" onChange={uploadLogo} className="hidden" id="store-logo-input" />
              <Button variant="secondary" loading={uploadingLogo} onClick={() => document.getElementById("store-logo-input")?.click()}>
                {logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {logoUrl && (
                <Button variant="ghost" loading={removingLogo} onClick={removeLogo}>
                  Remove
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

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

        <Card>
          <CardHeader title="Store policy" description="Shown on your storefront, and counted toward your Store Health Score's profile completeness." />
          <CardBody>
            <form onSubmit={savePolicyText} className="space-y-4">
              {policySaved && <Alert tone="success">Saved.</Alert>}
              <Field label="Policy statement" htmlFor="policy-text" hint="Shipping, returns, or other buyer-facing policy text.">
                <Textarea
                  id="policy-text"
                  rows={5}
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  placeholder="e.g. We ship within 2 business days. Returns accepted within 7 days of delivery."
                />
              </Field>
              <Button type="submit" loading={savingPolicy}>
                Save
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Data export"
            description="A convenience copy of your products, orders, and customers for your own records - delivered to your connected Google Drive, or emailed if Drive isn't connected. Not a substitute for our own platform backups."
          />
          <CardBody className="space-y-4">
            {exportError && <Alert>{exportError}</Alert>}
            <Button loading={requestingExport} onClick={requestDataExport}>
              Request export now
            </Button>
            {dataExports && dataExports.length > 0 && (
              <div className="divide-y divide-border">
                {dataExports.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm text-ink">{e.trigger === "on_demand" ? "Requested" : "Subscription renewal"}</p>
                      <p className="text-xs text-ink-muted">{new Date(e.createdAt).toLocaleString()}</p>
                      {e.status === "completed" && (
                        <div className="mt-1 flex gap-3">
                          {EXPORT_FILE_LABELS.filter((f) => e[f.flag]).map((f) => (
                            <button
                              key={f.file}
                              type="button"
                              className="text-xs text-accent underline"
                              onClick={() => downloadExportFile(e.id, f.file, `${f.file}.${f.file === "summary" ? "pdf" : "csv"}`)}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge tone={e.status === "completed" ? "success" : e.status === "failed" ? "danger" : "warning"}>
                      {e.status === "completed" ? `Sent via ${e.deliveryMethod}` : e.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
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
              <>
                <p className="mb-3 text-sm text-ink-muted">No CNIC on file yet - required before checkout works.</p>
                <ul className="mb-4 space-y-1 text-xs text-ink-muted">
                  <li>- Required for fraud prevention and payout compliance - it's how we confirm a real, accountable person is behind the store before money moves.</li>
                  <li>- Encrypted at rest. Nobody at UZEYN, including staff, can view the full number.</li>
                  <li>- Never shared with anyone - not other sellers, not buyers, not third parties.</li>
                  <li>- Only the last 4 digits are ever shown, anywhere, including to you after saving.</li>
                  <li>- Once verified, checkout unlocks for your store and orders can start coming in.</li>
                </ul>
              </>
            )}
            <form onSubmit={saveCnic} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={cnicMasked ? "Update CNIC" : "CNIC"}
                  hint="Encrypted at rest, never shown in full again - only the last 4 digits are kept visible."
                >
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
          <CardHeader
            title="Notifications"
            description="Platform emails about your account - separate from the order and stock alerts your store sends automatically, which can't be turned off."
          />
          <CardBody>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={!newsletterOptOut}
                disabled={savingNewsletterOptOut}
                onChange={toggleNewsletterOptOut}
              />
              Send me the UZEYN newsletter (product updates, tips, and announcements)
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Security"
            description="Two-factor authentication and the devices currently signed in to your account."
          />
          <CardBody className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Two-factor authentication</h3>
              {mfaEnabled ? (
                <Alert tone="success">2FA is enabled on your account.</Alert>
              ) : mfaSecret ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-muted">
                    Scan this into your authenticator app, then enter the 6-digit code it shows:
                  </p>
                  <p className="break-all rounded-md border border-border bg-surface-muted p-2 font-mono text-xs text-ink">
                    {mfaSecret.otpauthUrl}
                  </p>
                  <form onSubmit={verifyMfaEnrollment} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field label="6-digit code">
                        <Input
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value)}
                          placeholder="123456"
                          required
                        />
                      </Field>
                    </div>
                    <Button type="submit" loading={verifyingMfa}>
                      Confirm
                    </Button>
                  </form>
                </div>
              ) : (
                <Button type="button" onClick={beginMfaEnrollment} loading={enrollingMfa}>
                  Enable 2FA
                </Button>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Signed-in devices</h3>
              {sessions === null ? (
                <p className="text-sm text-ink-muted">Loading...</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-ink-muted">No active sessions.</p>
              ) : (
                <ul className="space-y-2">
                  {sessions.map((session) => (
                    <li
                      key={session.sessionId}
                      className="flex items-center justify-between gap-4 rounded-md border border-border p-3"
                    >
                      <div>
                        <p className="text-sm text-ink">
                          {session.deviceLabel}
                          {session.sessionId === currentSessionId && (
                            <span className="ml-2 rounded-full bg-accent-subtle px-2 py-0.5 text-xs text-accent">
                              This device
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {session.ipAddress} - last active {new Date(session.lastActiveAt).toLocaleString()}
                        </p>
                      </div>
                      {session.sessionId !== currentSessionId && (
                        <Button variant="ghost" size="sm" onClick={() => revokeSession(session.sessionId)}>
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Support access</h3>
              {supportAccessHistory === null ? (
                <p className="text-sm text-ink-muted">Loading...</p>
              ) : supportAccessHistory.length === 0 ? (
                <p className="text-sm text-ink-muted">uzeyn.com support has never accessed your account.</p>
              ) : (
                <ul className="space-y-2">
                  {supportAccessHistory.map((entry, i) => (
                    <li key={i} className="rounded-md border border-border p-3 text-sm text-ink-muted">
                      {new Date(entry.startedAt).toLocaleString()} - {entry.durationMinutes} min
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
