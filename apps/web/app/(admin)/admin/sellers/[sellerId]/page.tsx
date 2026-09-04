"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { adminApi, AdminApiError } from "@/lib/admin-api";

type LifecycleStatus = "active" | "warned" | "restricted" | "suspended" | "banned";

interface SellerOverview {
  seller: {
    id: string;
    businessName: string;
    email: string;
    kycStatus: string;
    activationStatus: string;
    lifecycleStatus: LifecycleStatus;
    isTrusted: boolean;
    createdAt: string;
  };
  stores: { id: string; name: string; slug: string; status: string; verifiedStatus: string; healthScore: number | null }[];
  wallet: { balance: number; currency: string; recentLedger: { id: string; type: string; amount: number; currency: string; createdAt: string; label: string }[] };
  invoices: { id: string; periodStart: string; periodEnd: string; totalAmount: number; status: string }[];
  programs: { id: string; programType: string; status: "pending" | "approved" | "rejected" | "suspended" | "terminated"; referralCode: string | null }[];
  trustSafety: {
    riskScore: number | null;
    cancellationRateFlag: { ratePercent: number } | null;
    pendingForeverRateFlag: { ratePercent: number } | null;
    bypassAttemptFlag: { attemptCount: number } | null;
    selfReferralFlags: { matchedSignal: string }[];
  };
  devices: { sessionId: string; deviceLabel: string; ipAddress: string; firstSeenAt: string; lastActiveAt: string }[];
  timeline: { source: string; createdAt: string; action: string; adminUserId: string | null }[];
}

const LIFECYCLE_STATUSES: LifecycleStatus[] = ["active", "warned", "restricted", "suspended", "banned"];
const lifecycleTone: Record<LifecycleStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  warned: "warning",
  restricted: "warning",
  suspended: "danger",
  banned: "danger",
};

// GO/RUN/RISE/FLY tierOrder mapping (plans.seed.ts) - D-Studio close-out's
// grant-with-duration control needs these as plain labels, not the
// creative-name-plus-subtitle treatment planTierSubtitle() gives seller-
// facing surfaces (this is an internal admin control, not a seller surface).
const TIER_LABELS = ["GO", "RUN", "RISE", "FLY"] as const;

// FR-52.14/FR-52.15 (Module 101, founder batch B14)
type StaffAccountAdminStatus = "active" | "suspended" | "blocked" | "revoked";
interface StaffAccountAdminRow {
  id: string;
  email: string;
  name: string | null;
  status: StaffAccountAdminStatus;
  suspendedUntil: string | null;
}
const STAFF_STATUS_TONE: Record<StaffAccountAdminStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  suspended: "warning",
  blocked: "danger",
  revoked: "neutral",
};

/**
 * Phase 6c (Admin Terminal re-skin) - Seller-360 (Module 25's per-seller
 * cross-linked view), restyled onto DashCard sections. Every control
 * preserved unchanged - lifecycle ladder, impersonation, wallet adjust,
 * stores/invoices, growth-program suspend/terminate + clawback, generic
 * Settings Registry override, D-Studio time-limited grant, Trust & Safety
 * flags, devices, timeline. `alert()` calls replaced with page-level Alert
 * state; no action removed or behavior changed.
 */
export default function AdminSellerOverviewPage({ params }: { params: { sellerId: string } }) {
  const confirm = useConfirm();
  const [overview, setOverview] = useState<SellerOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [impersonationSessionId, setImpersonationSessionId] = useState<string | null>(null);
  const [clawbackAmount, setClawbackAmount] = useState("");
  const [clawbackNotes, setClawbackNotes] = useState("");
  const [settingsKey, setSettingsKey] = useState("");
  const [settingsValue, setSettingsValue] = useState("");
  const [settingsLookup, setSettingsLookup] = useState<{
    valueType: string;
    effectiveValue: unknown;
    winningScope: string;
    requiresConfirmation: boolean;
  } | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [dstudioGrant, setDstudioGrant] = useState<{ tierOrder: number; expiresAt: string | null } | null>(null);
  const [dstudioGrantTier, setDstudioGrantTier] = useState<"0" | "1" | "2" | "3">("2");
  const [dstudioGrantDays, setDstudioGrantDays] = useState("14");
  const [dstudioGrantError, setDstudioGrantError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // FR-52.14/FR-52.15 (Module 101, founder batch B14)
  const [staffAccounts, setStaffAccounts] = useState<StaffAccountAdminRow[] | null>(null);
  const [staffActionError, setStaffActionError] = useState<string | null>(null);
  const [staffActionPanel, setStaffActionPanel] = useState<{ id: string; type: "suspend" | "block" } | null>(null);
  const [staffSuspendDays, setStaffSuspendDays] = useState("7");
  const [staffActionReason, setStaffActionReason] = useState("");

  function load() {
    adminApi
      .get<SellerOverview>(`/admin/sellers/${params.sellerId}/overview`)
      .then(setOverview)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load this seller."));
  }

  useEffect(load, [params.sellerId]);

  /**
   * D-Studio close-out (founder-requested time-limited feature grants) - a
   * Seller-360-scoped convenience over the same generic Settings Registry
   * resolve/write endpoints the "Settings overrides" section below already
   * uses, pre-filled to the one key (`dstudio.tier_override_order`) and
   * with a duration picker instead of a free-typed JSON value, since that
   * key's real point (an expiring grant) has no field in the generic form.
   */
  function loadDstudioGrant() {
    adminApi
      .get<{ chain: { scope: string; value: unknown; expiresAt: string | null }[] }>(
        `/admin/settings/resolve?key=dstudio.tier_override_order&sellerId=${params.sellerId}`,
      )
      .then((result) => {
        const sellerRow = result.chain.find((c) => c.scope === "seller");
        const tierOrder = typeof sellerRow?.value === "number" ? sellerRow.value : -1;
        setDstudioGrant(tierOrder >= 0 ? { tierOrder, expiresAt: sellerRow?.expiresAt ?? null } : null);
      })
      .catch(() => setDstudioGrant(null));
  }

  useEffect(loadDstudioGrant, [params.sellerId]);

  /** FR-52.14/FR-52.15 - admin visibility + lifecycle actions on this seller's staff roster (no such route existed before this FR). */
  function loadStaffAccounts() {
    adminApi
      .get<StaffAccountAdminRow[]>(`/admin/sellers/${params.sellerId}/staff-accounts`)
      .then(setStaffAccounts)
      .catch(() => setStaffAccounts([]));
  }

  useEffect(loadStaffAccounts, [params.sellerId]);

  async function suspendStaff(id: string, email: string) {
    setStaffActionError(null);
    const days = Number(staffSuspendDays);
    if (!days || days <= 0) {
      setStaffActionError("Duration must be a positive number of days.");
      return;
    }
    if (!staffActionReason.trim()) {
      setStaffActionError("A reason is required.");
      return;
    }
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const ok = await confirm({
      title: `Suspend ${email} for ${days} day(s)?`,
      description: "They cannot log in until this lifts (automatically) or an admin reactivates it early.",
      changes: [{ label: "Status", from: "active", to: `suspended until ${new Date(until).toLocaleString()}` }],
      confirmLabel: "Suspend",
      tone: "danger",
    });
    if (!ok) return;
    setPendingAction(`suspend-${id}`);
    try {
      await adminApi.post(`/admin/sellers/${params.sellerId}/staff-accounts/${id}/suspend`, { until, reason: staffActionReason });
      setStaffActionPanel(null);
      setStaffActionReason("");
      loadStaffAccounts();
    } catch (err) {
      setStaffActionError(err instanceof AdminApiError ? err.message : "Couldn't suspend that staff account.");
    } finally {
      setPendingAction(null);
    }
  }

  async function blockStaff(id: string, email: string) {
    setStaffActionError(null);
    if (!staffActionReason.trim()) {
      setStaffActionError("A reason is required.");
      return;
    }
    const ok = await confirm({
      title: `Permanently block ${email}?`,
      description: "They cannot log in until an admin explicitly reactivates this account. This does not auto-expire.",
      changes: [{ label: "Status", from: "active", to: "blocked" }],
      confirmLabel: "Block",
      tone: "danger",
    });
    if (!ok) return;
    setPendingAction(`block-${id}`);
    try {
      await adminApi.post(`/admin/sellers/${params.sellerId}/staff-accounts/${id}/block`, { reason: staffActionReason });
      setStaffActionPanel(null);
      setStaffActionReason("");
      loadStaffAccounts();
    } catch (err) {
      setStaffActionError(err instanceof AdminApiError ? err.message : "Couldn't block that staff account.");
    } finally {
      setPendingAction(null);
    }
  }

  async function reactivateStaff(id: string, email: string, from: StaffAccountAdminStatus) {
    setStaffActionError(null);
    const ok = await confirm({
      title: `Reactivate ${email}?`,
      description: "Restores normal login immediately.",
      changes: [{ label: "Status", from, to: "active" }],
      confirmLabel: "Reactivate",
    });
    if (!ok) return;
    setPendingAction(`reactivate-${id}`);
    try {
      await adminApi.post(`/admin/sellers/${params.sellerId}/staff-accounts/${id}/reactivate`, {});
      loadStaffAccounts();
    } catch (err) {
      setStaffActionError(err instanceof AdminApiError ? err.message : "Couldn't reactivate that staff account.");
    } finally {
      setPendingAction(null);
    }
  }

  async function resetStaffPassword(id: string, email: string) {
    setStaffActionError(null);
    const ok = await confirm({
      title: `Reset ${email}'s password?`,
      description: "Emails a one-time reset link to their own registered address. You will never see or set the new password yourself.",
      confirmLabel: "Send reset link",
    });
    if (!ok) return;
    setPendingAction(`reset-${id}`);
    try {
      await adminApi.post(`/admin/sellers/${params.sellerId}/staff-accounts/${id}/reset-password`, {});
    } catch (err) {
      setStaffActionError(err instanceof AdminApiError ? err.message : "Couldn't trigger a password reset for that staff account.");
    } finally {
      setPendingAction(null);
    }
  }

  async function grantDStudioAccess() {
    setDstudioGrantError(null);
    const days = Number(dstudioGrantDays);
    if (!days || days <= 0) {
      setDstudioGrantError("Duration must be a positive number of days.");
      return;
    }
    const tierOrder = Number(dstudioGrantTier);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const ok = await confirm({
      title: `Grant ${TIER_LABELS[tierOrder]}-tier D-Studio access to ${seller.businessName}?`,
      description: `This overrides their real plan tier for D-Studio only, for ${days} day(s), auto-reverting at expiry.`,
      changes: [{ label: "D-Studio tier", from: dstudioGrant ? TIER_LABELS[dstudioGrant.tierOrder] : "(none)", to: `${TIER_LABELS[tierOrder]} until ${new Date(expiresAt).toLocaleString()}` }],
      confirmLabel: "Grant access",
    });
    if (!ok) return;
    setPendingAction("grantDStudio");
    try {
      await adminApi.put("/admin/settings/values", {
        key: "dstudio.tier_override_order",
        scopeType: "seller",
        scopeId: params.sellerId,
        value: tierOrder,
        expiresAt,
      });
      loadDstudioGrant();
    } catch (err) {
      setDstudioGrantError(err instanceof AdminApiError ? err.message : "Couldn't grant D-Studio access.");
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeDStudioGrant() {
    const ok = await confirm({
      title: `Revoke ${seller.businessName}'s D-Studio grant?`,
      description: "Reverts D-Studio gating to their real plan tier immediately.",
      changes: [{ label: "D-Studio tier override", from: dstudioGrant ? TIER_LABELS[dstudioGrant.tierOrder] : "(none)", to: "(none)" }],
      confirmLabel: "Revoke",
      tone: "danger",
    });
    if (!ok) return;
    setPendingAction("revokeDStudio");
    try {
      await adminApi.put("/admin/settings/values", {
        key: "dstudio.tier_override_order",
        scopeType: "seller",
        scopeId: params.sellerId,
        value: -1,
        expiresAt: null,
      });
      loadDstudioGrant();
    } catch (err) {
      setDstudioGrantError(err instanceof AdminApiError ? err.message : "Couldn't revoke this grant.");
    } finally {
      setPendingAction(null);
    }
  }

  async function setLifecycleStatus(status: LifecycleStatus) {
    setError(null);
    if (!reason.trim()) {
      setError("A reason is required for every lifecycle action.");
      return;
    }
    const ok = await confirm({
      title: `Set ${seller.businessName} to "${status}"?`,
      description: `This changes the seller's lifecycle status from "${seller.lifecycleStatus}" to "${status}" and is visible to the seller. Reason: ${reason}`,
      changes: [{ label: "Lifecycle status", from: seller.lifecycleStatus, to: status }],
      confirmLabel: `Set ${status}`,
      tone: status === "banned" || status === "suspended" ? "danger" : "default",
    });
    if (!ok) return;
    setPendingAction(`lifecycle:${status}`);
    try {
      await adminApi.post(`/admin/sellers/${params.sellerId}/lifecycle`, { status, reason });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't update this seller's lifecycle status.");
    } finally {
      setPendingAction(null);
    }
  }

  async function approveActivation() {
    setError(null);
    setPendingAction("approveActivation");
    try {
      await adminApi.post(`/admin/sellers/${params.sellerId}/activation/approve`);
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't approve this activation.");
    } finally {
      setPendingAction(null);
    }
  }

  async function adjustWallet() {
    setError(null);
    const amount = Number(adjustAmount);
    if (!amount || !adjustReason.trim()) {
      setError("An amount and a reason are both required.");
      return;
    }
    const newBalance = wallet.balance + amount;
    const ok = await confirm({
      title: `${amount > 0 ? "Credit" : "Debit"} ${seller.businessName}'s wallet?`,
      description: `Reason: ${adjustReason}`,
      changes: [
        {
          label: "Wallet balance",
          from: `${wallet.currency} ${wallet.balance.toFixed(2)}`,
          to: `${wallet.currency} ${newBalance.toFixed(2)}`,
        },
      ],
      confirmLabel: "Adjust wallet",
      tone: amount < 0 ? "danger" : "default",
    });
    if (!ok) return;
    setPendingAction("adjustWallet");
    try {
      await adminApi.post(`/admin/wallet-topups/sellers/${params.sellerId}/adjust`, { amount, reason: adjustReason });
      setAdjustAmount("");
      setAdjustReason("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't adjust this seller's wallet.");
    } finally {
      setPendingAction(null);
    }
  }

  async function impersonate() {
    const impersonationReason = window.prompt("Reason for this support session:");
    if (!impersonationReason) return;
    setError(null);
    setPendingAction("impersonate");
    try {
      const body = await adminApi.post<{ accessToken: string; impersonationSessionId: string }>(
        `/admin/sellers/${params.sellerId}/impersonate`,
        { reason: impersonationReason },
      );
      setImpersonationSessionId(body.impersonationSessionId);
      window.open(`/impersonate?token=${encodeURIComponent(body.accessToken)}&sessionId=${body.impersonationSessionId}`, "_blank");
    } catch {
      setError("Couldn't start a support session for this seller.");
    } finally {
      setPendingAction(null);
    }
  }

  async function endImpersonation() {
    if (!impersonationSessionId) return;
    await adminApi.post(`/admin/impersonation/${impersonationSessionId}/end`);
    setImpersonationSessionId(null);
  }

  async function decideProgramParticipant(participantId: string, action: "suspend" | "terminate") {
    const notes = window.prompt(`Reason to ${action} this program participation:`);
    if (!notes) return;
    setError(null);
    setPendingAction(`program:${participantId}:${action}`);
    try {
      await adminApi.post(`/admin/growth-programs/applications/${participantId}/${action}`, { notes });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : `Couldn't ${action} this participation.`);
    } finally {
      setPendingAction(null);
    }
  }

  /**
   * Module 37 (SRS §5.54/FR-54.4) - a Seller-360-scoped, pre-filled
   * convenience over the already-generic Settings Registry admin API
   * (the same PUT /admin/settings/values the standalone /admin/settings
   * page uses) - not a new write mechanism, just this page's own context
   * (sellerId) pre-filled in rather than free-typed.
   */
  async function lookupSetting() {
    setSettingsError(null);
    setSettingsLookup(null);
    if (!settingsKey.trim()) return;
    setPendingAction("lookupSetting");
    try {
      const result = await adminApi.get<{ valueType: string; effectiveValue: unknown; winningScope: string; requiresConfirmation: boolean }>(
        `/admin/settings/resolve?key=${encodeURIComponent(settingsKey.trim())}&sellerId=${params.sellerId}`,
      );
      setSettingsLookup(result);
    } catch (err) {
      setSettingsError(err instanceof AdminApiError ? err.message : "Couldn't look up that settings key.");
    } finally {
      setPendingAction(null);
    }
  }

  async function overrideSettingForSeller() {
    setSettingsError(null);
    if (!settingsKey.trim() || !settingsValue.trim()) {
      setSettingsError("A key and a value are both required.");
      return;
    }
    let parsedValue: unknown = settingsValue.trim();
    try {
      parsedValue = JSON.parse(settingsValue.trim());
    } catch {
      // Not valid JSON - keep it as the raw string (e.g. a plain non-quoted string value).
    }
    if (settingsLookup?.requiresConfirmation) {
      const ok = await confirm({
        title: `Override "${settingsKey.trim()}" for ${seller.businessName}?`,
        description: "This is a high-impact settings key (FR-8.16) - it takes effect for this seller only, overriding any plan/global default.",
        changes: [{ label: settingsKey.trim(), from: JSON.stringify(settingsLookup.effectiveValue), to: JSON.stringify(parsedValue) }],
        confirmLabel: "Override",
        tone: "danger",
      });
      if (!ok) return;
    }
    setPendingAction("overrideSetting");
    try {
      await adminApi.put("/admin/settings/values", { key: settingsKey.trim(), scopeType: "seller", scopeId: params.sellerId, value: parsedValue });
      setSettingsValue("");
      await lookupSetting();
    } catch (err) {
      setSettingsError(err instanceof AdminApiError ? err.message : "Couldn't set that override.");
    } finally {
      setPendingAction(null);
    }
  }

  async function clawback() {
    setError(null);
    const amount = Number(clawbackAmount);
    if (!amount || !clawbackNotes.trim()) {
      setError("An amount and a reason are both required for a clawback.");
      return;
    }
    const ok = await confirm({
      title: `Clawback ${wallet.currency} ${amount.toFixed(2)} from ${seller.businessName}?`,
      description: `Reason: ${clawbackNotes}`,
      changes: [
        {
          label: "Wallet balance",
          from: `${wallet.currency} ${wallet.balance.toFixed(2)}`,
          to: `${wallet.currency} ${(wallet.balance - amount).toFixed(2)}`,
        },
      ],
      confirmLabel: "Clawback",
      tone: "danger",
    });
    if (!ok) return;
    setPendingAction("clawback");
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/sellers/${params.sellerId}/clawback`, { amount, notes: clawbackNotes });
      setClawbackAmount("");
      setClawbackNotes("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't clawback this seller's wallet.");
    } finally {
      setPendingAction(null);
    }
  }

  if (error && !overview) return <Alert tone="danger">{error}</Alert>;
  if (!overview) return <PageSpinner />;

  const { seller, stores, wallet, invoices, programs, trustSafety, devices, timeline } = overview;

  return (
    <div className="space-y-4">
      <PageHeader
        title={seller.businessName}
        description={`${seller.email} · KYC: ${seller.kycStatus}${seller.isTrusted ? " · TRUSTED" : ""}`}
      />
      <div className="-mt-4 flex items-center gap-2">
        <Badge tone={lifecycleTone[seller.lifecycleStatus]}>{seller.lifecycleStatus}</Badge>
        <Badge tone={seller.activationStatus === "auto_approved" ? "success" : "warning"}>{seller.activationStatus}</Badge>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <DashCard>
        <DashCardHeader title="Actions" description="Every lifecycle action is reason-required and audited." />
        <Field label="Reason (required for lifecycle actions)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you taking this action?" />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          {seller.activationStatus !== "auto_approved" && (
            <Button variant="secondary" size="sm" onClick={approveActivation} loading={pendingAction === "approveActivation"} disabled={pendingAction !== null && pendingAction !== "approveActivation"}>
              Approve activation
            </Button>
          )}
          {LIFECYCLE_STATUSES.map((s) => (
            <Button
              key={s}
              variant={s === "banned" || s === "suspended" ? "danger" : "ghost"}
              size="sm"
              disabled={s === seller.lifecycleStatus || (pendingAction !== null && pendingAction !== `lifecycle:${s}`)}
              loading={pendingAction === `lifecycle:${s}`}
              onClick={() => setLifecycleStatus(s)}
            >
              Set {s}
            </Button>
          ))}
          {impersonationSessionId ? (
            <Button variant="ghost" size="sm" onClick={endImpersonation}>
              End impersonation session
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={impersonate} loading={pendingAction === "impersonate"} disabled={pendingAction !== null && pendingAction !== "impersonate"}>
              Impersonate (login as seller)
            </Button>
          )}
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader title="Wallet" description={`Balance: ${wallet.currency} ${wallet.balance.toFixed(2)}`} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-40">
            <Field label="Adjust amount (+credit / -debit)">
              <Input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Reason">
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </Field>
          </div>
          <Button onClick={adjustWallet} loading={pendingAction === "adjustWallet"} disabled={pendingAction !== null && pendingAction !== "adjustWallet"}>
            Adjust
          </Button>
        </div>
        {wallet.recentLedger.length > 0 && (
          <div className="mt-4 divide-y divide-border border-t border-border">
            {wallet.recentLedger.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-ink-muted">{new Date(l.createdAt).toLocaleString()}</span>
                <span className="flex-1 px-2 text-ink">{l.label}</span>
                <span className="font-medium tabular-nums text-ink">{l.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard>
        <DashCardHeader title={`Stores (${stores.length})`} />
        <div className="divide-y divide-border">
          {stores.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="font-medium text-ink">{s.name}</span>
              <span className="flex items-center gap-2">
                <Badge tone="neutral">{s.status}</Badge>
                <Badge tone={s.verifiedStatus === "verified" ? "success" : "neutral"}>{s.verifiedStatus}</Badge>
                <span className="text-ink-muted">Health: {s.healthScore ?? "-"}</span>
              </span>
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader title={`Invoices (${invoices.length})`} />
        <div className="divide-y divide-border">
          {invoices.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="text-ink">
                {new Date(i.periodStart).toLocaleDateString()} - {new Date(i.periodEnd).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-ink-muted">{i.totalAmount}</span>
                <Badge tone="neutral">{i.status}</Badge>
              </span>
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader title="Growth program participation" />
        <div className="divide-y divide-border">
          {programs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink">
                {p.programType} {p.referralCode && <span className="text-ink-muted">({p.referralCode})</span>}
              </span>
              <span className="flex items-center gap-2">
                <Badge tone="neutral">{p.status}</Badge>
                {p.status === "approved" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => decideProgramParticipant(p.id, "suspend")}
                      loading={pendingAction === `program:${p.id}:suspend`}
                      disabled={pendingAction !== null && pendingAction !== `program:${p.id}:suspend`}
                    >
                      Suspend
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => decideProgramParticipant(p.id, "terminate")}
                      loading={pendingAction === `program:${p.id}:terminate`}
                      disabled={pendingAction !== null && pendingAction !== `program:${p.id}:terminate`}
                    >
                      Terminate
                    </Button>
                  </>
                )}
                {p.status === "suspended" && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => decideProgramParticipant(p.id, "terminate")}
                    loading={pendingAction === `program:${p.id}:terminate`}
                    disabled={pendingAction !== null && pendingAction !== `program:${p.id}:terminate`}
                  >
                    Terminate
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
          <div className="sm:w-40">
            <Field label="Clawback amount">
              <Input value={clawbackAmount} onChange={(e) => setClawbackAmount(e.target.value)} />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Reason">
              <Input value={clawbackNotes} onChange={(e) => setClawbackNotes(e.target.value)} />
            </Field>
          </div>
          <Button variant="danger" onClick={clawback} loading={pendingAction === "clawback"} disabled={pendingAction !== null && pendingAction !== "clawback"}>
            Clawback (FR-33.10)
          </Button>
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader
          title="Settings overrides"
          description={`Override any existing boolean/numeric Settings Registry key for this seller only - the seller-scope override wins over any plan/global default, and only for this seller (SRS §5.54/FR-54.4). E.g. catalog.listing_blocked.`}
        />
        {settingsError && <Alert tone="danger">{settingsError}</Alert>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Field label="Settings key">
              <Input value={settingsKey} onChange={(e) => setSettingsKey(e.target.value)} placeholder="catalog.listing_blocked" />
            </Field>
          </div>
          <Button variant="secondary" onClick={lookupSetting} loading={pendingAction === "lookupSetting"} disabled={pendingAction !== null && pendingAction !== "lookupSetting"}>
            Look up
          </Button>
        </div>
        {settingsLookup && (
          <p className="mt-2 text-sm text-ink-muted">
            Type: <span className="font-medium text-ink">{settingsLookup.valueType}</span> · effective value:{" "}
            <span className="font-medium text-ink">{JSON.stringify(settingsLookup.effectiveValue)}</span> · winning scope:{" "}
            <span className="font-medium text-ink">{settingsLookup.winningScope}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Field label="New value for this seller (JSON, e.g. true or 5)">
              <Input value={settingsValue} onChange={(e) => setSettingsValue(e.target.value)} />
            </Field>
          </div>
          <Button onClick={overrideSettingForSeller} loading={pendingAction === "overrideSetting"} disabled={pendingAction !== null && pendingAction !== "overrideSetting"}>
            Override for this seller
          </Button>
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader
          title="D-Studio access grant"
          description="Grant this seller any tier's D-Studio capability (sections/animation presets/variants) for a fixed window, independent of their real plan - auto-reverts at expiry, never requires a follow-up action to undo."
        />
        {dstudioGrant ? (
          <p className="text-sm text-ink">
            Current grant: <strong>{TIER_LABELS[dstudioGrant.tierOrder]}</strong>
            {dstudioGrant.expiresAt ? ` until ${new Date(dstudioGrant.expiresAt).toLocaleString()}` : " (no expiry set)"}{" "}
            <Button variant="ghost" size="sm" onClick={revokeDStudioGrant} loading={pendingAction === "revokeDStudio"} disabled={pendingAction !== null && pendingAction !== "revokeDStudio"}>
              Revoke
            </Button>
          </p>
        ) : (
          <p className="text-sm text-ink-muted">No active grant - D-Studio gates against this seller&apos;s real plan tier.</p>
        )}
        {dstudioGrantError && <Alert tone="danger">{dstudioGrantError}</Alert>}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Field label="Tier">
              <Select value={dstudioGrantTier} onChange={(e) => setDstudioGrantTier(e.target.value as typeof dstudioGrantTier)}>
                {TIER_LABELS.map((label, tierOrder) => (
                  <option key={label} value={String(tierOrder)}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-24">
            <Field label="Days">
              <Input type="number" min={1} value={dstudioGrantDays} onChange={(e) => setDstudioGrantDays(e.target.value)} />
            </Field>
          </div>
          <Button onClick={grantDStudioAccess} loading={pendingAction === "grantDStudio"} disabled={pendingAction !== null && pendingAction !== "grantDStudio"}>
            Grant access
          </Button>
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader
          title="Staff accounts"
          description="FR-52.14/FR-52.15 - suspend (time-boxed, auto-lifts) or permanently block a staff account, or trigger a reset-not-reveal password reset. Distinct from the seller's own device/expiry controls - these are platform-admin actions."
        />
        {staffActionError && <Alert tone="danger">{staffActionError}</Alert>}
        {!staffAccounts ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : staffAccounts.length === 0 ? (
          <p className="text-sm text-ink-muted">This seller has no staff accounts.</p>
        ) : (
          <div className="divide-y divide-border">
            {staffAccounts.map((s) => (
              <div key={s.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{s.name || s.email}</p>
                    <p className="text-xs text-ink-muted">{s.email}</p>
                    {s.status === "suspended" && s.suspendedUntil && (
                      <p className="text-xs text-ink-muted">Until {new Date(s.suspendedUntil).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STAFF_STATUS_TONE[s.status]}>{s.status}</Badge>
                    {s.status === "active" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStaffActionPanel(staffActionPanel?.id === s.id && staffActionPanel.type === "suspend" ? null : { id: s.id, type: "suspend" })}
                        >
                          Suspend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStaffActionPanel(staffActionPanel?.id === s.id && staffActionPanel.type === "block" ? null : { id: s.id, type: "block" })}
                        >
                          Block
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => resetStaffPassword(s.id, s.email)} loading={pendingAction === `reset-${s.id}`} disabled={pendingAction !== null && pendingAction !== `reset-${s.id}`}>
                          Reset password
                        </Button>
                      </>
                    )}
                    {(s.status === "suspended" || s.status === "blocked") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => reactivateStaff(s.id, s.email, s.status)}
                        loading={pendingAction === `reactivate-${s.id}`}
                        disabled={pendingAction !== null && pendingAction !== `reactivate-${s.id}`}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
                {staffActionPanel?.id === s.id && (
                  <div className="mt-2 flex flex-wrap items-end gap-3 rounded-md bg-canvas p-3">
                    {staffActionPanel.type === "suspend" && (
                      <div className="w-24">
                        <Field label="Days">
                          <Input type="number" min={1} value={staffSuspendDays} onChange={(e) => setStaffSuspendDays(e.target.value)} />
                        </Field>
                      </div>
                    )}
                    <div className="flex-1" style={{ minWidth: "12rem" }}>
                      <Field label="Reason">
                        <Input value={staffActionReason} onChange={(e) => setStaffActionReason(e.target.value)} placeholder="Why is this account being actioned?" />
                      </Field>
                    </div>
                    <Button
                      variant={staffActionPanel.type === "block" ? "danger" : "primary"}
                      onClick={() => (staffActionPanel.type === "suspend" ? suspendStaff(s.id, s.email) : blockStaff(s.id, s.email))}
                      loading={pendingAction === `${staffActionPanel.type}-${s.id}`}
                      disabled={pendingAction !== null && pendingAction !== `${staffActionPanel.type}-${s.id}`}
                    >
                      Confirm {staffActionPanel.type}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard>
        <DashCardHeader title="Trust & Safety" />
        <div className="space-y-2 text-sm">
          <p className="text-ink">
            Risk score: <span className="font-medium">{trustSafety.riskScore ?? "-"}</span>
          </p>
          {trustSafety.cancellationRateFlag && (
            <Badge tone="warning">Flagged: cancellation rate {trustSafety.cancellationRateFlag.ratePercent}%</Badge>
          )}
          {trustSafety.pendingForeverRateFlag && (
            <Badge tone="warning">Flagged: pending-forever rate {trustSafety.pendingForeverRateFlag.ratePercent}%</Badge>
          )}
          {trustSafety.bypassAttemptFlag && (
            <Badge tone="danger">Flagged: {trustSafety.bypassAttemptFlag.attemptCount} moderation bypass attempts</Badge>
          )}
          {trustSafety.selfReferralFlags.map((f, i) => (
            <Badge key={i} tone="danger">
              Flagged: self-referral signal ({f.matchedSignal})
            </Badge>
          ))}
        </div>
      </DashCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashCard>
          <DashCardHeader title={`Devices / sessions (${devices.length})`} />
          <div className="divide-y divide-border">
            {devices.map((d) => (
              <div key={d.sessionId} className="py-2 text-sm">
                <p className="font-medium text-ink">{d.deviceLabel}</p>
                <p className="text-ink-muted">
                  {d.ipAddress} · last active {new Date(d.lastActiveAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader title="Timeline" />
          <div className="divide-y divide-border">
            {timeline.map((t, i) => (
              <div key={i} className="py-2 text-sm">
                <span className="text-ink-muted">{new Date(t.createdAt).toLocaleString()}</span>{" "}
                <span className="text-ink">{t.action}</span>
              </div>
            ))}
          </div>
        </DashCard>
      </div>
    </div>
  );
}
