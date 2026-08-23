"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface BankInstructions {
  enabled: boolean;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  bankName: string;
}
interface WalletInstructions {
  enabled: boolean;
  accountTitle: string;
  number: string;
}
interface PlatformPaymentInstructions {
  bank: BankInstructions;
  easypaisa: WalletInstructions;
  jazzcash: WalletInstructions;
}

const KEY = "billing.platform_payment_instructions";

const EMPTY: PlatformPaymentInstructions = {
  bank: { enabled: false, accountTitle: "", accountNumber: "", iban: "", bankName: "" },
  easypaisa: { enabled: false, accountTitle: "", number: "" },
  jazzcash: { enabled: false, accountTitle: "", number: "" },
};

/**
 * v0.41 audit fix (SRS FR-6.23) - ManualBankTransferTopUpAdapter used to
 * return a hardcoded placeholder sentence with no real receiving-account
 * details anywhere; a seller submitting a subscription/plan-fee payment
 * had no way to know where to actually send it. This page is the
 * founder-facing fix: a real form over the underlying
 * `billing.platform_payment_instructions` Settings Registry key (reusing
 * the same GET .../resolve and PUT .../values endpoints the generic
 * Settings Registry editor already uses), so receiving accounts can be
 * added/changed without a deploy. Distinct from a store's own
 * StorePaymentInstructions (Payments settings) - that's where a STORE
 * receives ITS buyers' payments; this is where the PLATFORM receives a
 * seller's own subscription payment.
 */
export default function AdminPaymentInstructionsPage() {
  const confirm = useConfirm();
  const [current, setCurrent] = useState<PlatformPaymentInstructions | null>(null);
  const [draft, setDraft] = useState<PlatformPaymentInstructions>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    adminApi
      .get<{ effectiveValue: PlatformPaymentInstructions }>(`/admin/settings/resolve?key=${KEY}`)
      .then((res) => {
        setCurrent(res.effectiveValue);
        setDraft(res.effectiveValue);
      })
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load payment instructions."));
  }

  useEffect(load, []);

  async function save() {
    setError(null);
    setSaved(false);
    const ok = await confirm({
      title: "Update platform payment instructions?",
      description:
        "This changes where every seller is told to send their subscription/plan-fee payment (FR-8.16 - a bad value here sends real money to the wrong place).",
      changes: [{ label: "billing.platform_payment_instructions", from: JSON.stringify(current), to: JSON.stringify(draft) }],
      confirmLabel: "Save",
      tone: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await adminApi.put("/admin/settings/values", { key: KEY, scopeType: "global", value: draft });
      setCurrent(draft);
      setSaved(true);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't save payment instructions.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !current) return <main>{error}</main>;
  if (!current) return <main>Loading...</main>;

  return (
    <main>
      <h1>Platform payment instructions (bare view - no design pass yet)</h1>
      <p>
        Where a seller is told to send their subscription/plan-fee payment (SRS FR-6.23) - shown on the seller&apos;s
        Billing &amp; Plan page the moment they submit a payment. Distinct from a store&apos;s own payment
        instructions (Payments settings), which is where that store receives its own buyers&apos; payments. Each
        method below is independently enabled - a disabled or blank method is never shown to a seller.
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {saved && <p style={{ color: "green" }}>Saved.</p>}

      <section style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #ccc" }}>
        <h2>
          <label>
            <input
              type="checkbox"
              checked={draft.bank.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, enabled: e.target.checked } }))}
            />{" "}
            Bank transfer
          </label>
        </h2>
        <p>
          <label>
            Bank name: <input value={draft.bank.bankName} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, bankName: e.target.value } }))} />
          </label>
        </p>
        <p>
          <label>
            Account title:{" "}
            <input value={draft.bank.accountTitle} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, accountTitle: e.target.value } }))} />
          </label>
        </p>
        <p>
          <label>
            Account number:{" "}
            <input value={draft.bank.accountNumber} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, accountNumber: e.target.value } }))} />
          </label>
        </p>
        <p>
          <label>
            IBAN (optional): <input value={draft.bank.iban} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, iban: e.target.value } }))} />
          </label>
        </p>
      </section>

      <section style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #ccc" }}>
        <h2>
          <label>
            <input
              type="checkbox"
              checked={draft.easypaisa.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, easypaisa: { ...d.easypaisa, enabled: e.target.checked } }))}
            />{" "}
            Easypaisa
          </label>
        </h2>
        <p>
          <label>
            Account title:{" "}
            <input
              value={draft.easypaisa.accountTitle}
              onChange={(e) => setDraft((d) => ({ ...d, easypaisa: { ...d.easypaisa, accountTitle: e.target.value } }))}
            />
          </label>
        </p>
        <p>
          <label>
            Number: <input value={draft.easypaisa.number} onChange={(e) => setDraft((d) => ({ ...d, easypaisa: { ...d.easypaisa, number: e.target.value } }))} />
          </label>
        </p>
      </section>

      <section style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #ccc" }}>
        <h2>
          <label>
            <input
              type="checkbox"
              checked={draft.jazzcash.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, jazzcash: { ...d.jazzcash, enabled: e.target.checked } }))}
            />{" "}
            JazzCash
          </label>
        </h2>
        <p>
          <label>
            Account title:{" "}
            <input
              value={draft.jazzcash.accountTitle}
              onChange={(e) => setDraft((d) => ({ ...d, jazzcash: { ...d.jazzcash, accountTitle: e.target.value } }))}
            />
          </label>
        </p>
        <p>
          <label>
            Number: <input value={draft.jazzcash.number} onChange={(e) => setDraft((d) => ({ ...d, jazzcash: { ...d.jazzcash, number: e.target.value } }))} />
          </label>
        </p>
      </section>

      <button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </main>
  );
}
