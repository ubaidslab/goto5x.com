"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
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

/**
 * Module 25 (Admin Completion) - the seller-360 page (§14 gap: per-seller
 * data was scattered across 6 siloed screens with no ID-based cross-
 * linking). Every inline action here reuses an existing, already-guarded
 * endpoint (lifecycle change, impersonate) or the one new endpoint this
 * module adds (wallet adjust) - none bypass the reason-required/audit-log
 * discipline those endpoints already enforce server-side.
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

  function load() {
    adminApi
      .get<SellerOverview>(`/admin/sellers/${params.sellerId}/overview`)
      .then(setOverview)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load this seller."));
  }

  useEffect(load, [params.sellerId]);

  async function setLifecycleStatus(status: LifecycleStatus) {
    if (!reason.trim()) {
      alert("A reason is required for every lifecycle action.");
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
    await adminApi.post(`/admin/sellers/${params.sellerId}/lifecycle`, { status, reason });
    load();
  }

  async function approveActivation() {
    await adminApi.post(`/admin/sellers/${params.sellerId}/activation/approve`);
    load();
  }

  async function adjustWallet() {
    const amount = Number(adjustAmount);
    if (!amount || !adjustReason.trim()) {
      alert("An amount and a reason are both required.");
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
    try {
      await adminApi.post(`/admin/wallet-topups/sellers/${params.sellerId}/adjust`, { amount, reason: adjustReason });
      setAdjustAmount("");
      setAdjustReason("");
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't adjust this seller's wallet.");
    }
  }

  async function impersonate() {
    const impersonationReason = window.prompt("Reason for this support session:");
    if (!impersonationReason) return;
    try {
      const body = await adminApi.post<{ accessToken: string; impersonationSessionId: string }>(
        `/admin/sellers/${params.sellerId}/impersonate`,
        { reason: impersonationReason },
      );
      setImpersonationSessionId(body.impersonationSessionId);
      window.open(`/impersonate?token=${encodeURIComponent(body.accessToken)}&sessionId=${body.impersonationSessionId}`, "_blank");
    } catch {
      alert("Couldn't start a support session for this seller.");
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
    try {
      await adminApi.post(`/admin/growth-programs/applications/${participantId}/${action}`, { notes });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : `Couldn't ${action} this participation.`);
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
    try {
      const result = await adminApi.get<{ valueType: string; effectiveValue: unknown; winningScope: string; requiresConfirmation: boolean }>(
        `/admin/settings/resolve?key=${encodeURIComponent(settingsKey.trim())}&sellerId=${params.sellerId}`,
      );
      setSettingsLookup(result);
    } catch (err) {
      setSettingsError(err instanceof AdminApiError ? err.message : "Couldn't look up that settings key.");
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
    try {
      await adminApi.put("/admin/settings/values", { key: settingsKey.trim(), scopeType: "seller", scopeId: params.sellerId, value: parsedValue });
      setSettingsValue("");
      await lookupSetting();
    } catch (err) {
      setSettingsError(err instanceof AdminApiError ? err.message : "Couldn't set that override.");
    }
  }

  async function clawback() {
    const amount = Number(clawbackAmount);
    if (!amount || !clawbackNotes.trim()) {
      alert("An amount and a reason are both required for a clawback.");
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
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/sellers/${params.sellerId}/clawback`, { amount, notes: clawbackNotes });
      setClawbackAmount("");
      setClawbackNotes("");
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't clawback this seller's wallet.");
    }
  }

  if (error) return <main>{error}</main>;
  if (!overview) return <main>Loading...</main>;

  const { seller, stores, wallet, invoices, programs, trustSafety, devices, timeline } = overview;

  return (
    <main>
      <h1>{seller.businessName}</h1>
      <p>
        {seller.email} - lifecycle: {seller.lifecycleStatus} - activation: {seller.activationStatus} - KYC: {seller.kycStatus}
        {seller.isTrusted && " - TRUSTED"}
      </p>

      <h2>Actions</h2>
      <p>
        <label>
          Reason (required for lifecycle actions): <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </p>
      {seller.activationStatus !== "auto_approved" && <button onClick={approveActivation}>Approve activation</button>}
      {LIFECYCLE_STATUSES.map((s) => (
        <button key={s} onClick={() => setLifecycleStatus(s)} disabled={s === seller.lifecycleStatus}>
          Set {s}
        </button>
      ))}
      {impersonationSessionId ? (
        <button onClick={endImpersonation}>End impersonation session</button>
      ) : (
        <button onClick={impersonate}>Impersonate (login as seller)</button>
      )}

      <h2>Wallet</h2>
      <p>
        Balance: {wallet.currency} {wallet.balance.toFixed(2)}
      </p>
      <p>
        <label>
          Adjust amount (+credit / -debit): <input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
        </label>{" "}
        <label>
          Reason: <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
        </label>{" "}
        <button onClick={adjustWallet}>Adjust</button>
      </p>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {wallet.recentLedger.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.label}</td>
              <td>{l.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Stores</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Verified</th>
            <th>Health score</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.status}</td>
              <td>{s.verifiedStatus}</td>
              <td>{s.healthScore ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Invoices</h2>
      <ul>
        {invoices.map((i) => (
          <li key={i.id}>
            {new Date(i.periodStart).toLocaleDateString()} - {new Date(i.periodEnd).toLocaleDateString()}: {i.totalAmount} ({i.status})
          </li>
        ))}
      </ul>

      <h2>Growth program participation</h2>
      <ul>
        {programs.map((p) => (
          <li key={p.id}>
            {p.programType}: {p.status} {p.referralCode && `(${p.referralCode})`}{" "}
            {p.status === "approved" && (
              <>
                <button onClick={() => decideProgramParticipant(p.id, "suspend")}>Suspend</button>{" "}
                <button onClick={() => decideProgramParticipant(p.id, "terminate")}>Terminate</button>
              </>
            )}
            {p.status === "suspended" && <button onClick={() => decideProgramParticipant(p.id, "terminate")}>Terminate</button>}
          </li>
        ))}
      </ul>
      <p>
        <label>
          Clawback amount: <input value={clawbackAmount} onChange={(e) => setClawbackAmount(e.target.value)} />
        </label>{" "}
        <label>
          Reason: <input value={clawbackNotes} onChange={(e) => setClawbackNotes(e.target.value)} />
        </label>{" "}
        <button onClick={clawback}>Clawback (FR-33.10)</button>
      </p>

      <h2>Settings overrides</h2>
      <p>
        Override any existing boolean/numeric Settings Registry key for this seller only - the seller-scope override
        wins over any plan/global default, and only for this seller (SRS §5.54/FR-54.4). E.g. <code>catalog.listing_blocked</code>.
      </p>
      {settingsError && <p style={{ color: "crimson" }}>{settingsError}</p>}
      <p>
        <label>
          Settings key: <input value={settingsKey} onChange={(e) => setSettingsKey(e.target.value)} placeholder="catalog.listing_blocked" />
        </label>{" "}
        <button onClick={lookupSetting}>Look up</button>
      </p>
      {settingsLookup && (
        <p>
          Type: {settingsLookup.valueType} - effective value: {JSON.stringify(settingsLookup.effectiveValue)} - winning scope:{" "}
          {settingsLookup.winningScope}
        </p>
      )}
      <p>
        <label>
          New value for this seller (JSON, e.g. <code>true</code> or <code>5</code>):{" "}
          <input value={settingsValue} onChange={(e) => setSettingsValue(e.target.value)} />
        </label>{" "}
        <button onClick={overrideSettingForSeller}>Override for this seller</button>
      </p>

      <h2>Trust &amp; Safety</h2>
      <p>Risk score: {trustSafety.riskScore ?? "-"}</p>
      {trustSafety.cancellationRateFlag && <p>Flagged: cancellation rate {trustSafety.cancellationRateFlag.ratePercent}%</p>}
      {trustSafety.pendingForeverRateFlag && <p>Flagged: pending-forever rate {trustSafety.pendingForeverRateFlag.ratePercent}%</p>}
      {trustSafety.bypassAttemptFlag && <p>Flagged: {trustSafety.bypassAttemptFlag.attemptCount} moderation bypass attempts</p>}
      {trustSafety.selfReferralFlags.map((f, i) => (
        <p key={i}>Flagged: self-referral signal ({f.matchedSignal})</p>
      ))}

      <h2>Devices / sessions</h2>
      <ul>
        {devices.map((d) => (
          <li key={d.sessionId}>
            {d.deviceLabel} - {d.ipAddress} - last active {new Date(d.lastActiveAt).toLocaleString()}
          </li>
        ))}
      </ul>

      <h2>Timeline</h2>
      <ul>
        {timeline.map((t, i) => (
          <li key={i}>
            {new Date(t.createdAt).toLocaleString()} - {t.action}
          </li>
        ))}
      </ul>
    </main>
  );
}
