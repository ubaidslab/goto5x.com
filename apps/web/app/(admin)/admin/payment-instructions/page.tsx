"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DashCard } from "@/components/dashboard/ui/DashCard";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

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
 * Phase 6c (Admin Terminal re-skin) - v0.41's platform payment instructions
 * form (FR-6.23), restyled onto DashCard. Every field/method preserved,
 * each still independently enable-able.
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

  if (error && !current) return <Alert tone="danger">{error}</Alert>;
  if (!current) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Platform payment instructions"
        description="Where a seller is told to send their subscription/plan-fee payment (SRS FR-6.23) - shown on the seller's Billing & Plan page the moment they submit a payment. Distinct from a store's own payment instructions (Payments settings), which is where that store receives its own buyers' payments. Each method below is independently enabled - a disabled or blank method is never shown to a seller."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <div className="max-w-2xl space-y-4">
        <DashCard>
          <label className="mb-5 flex items-center gap-2 text-base font-semibold text-ink">
            <input type="checkbox" checked={draft.bank.enabled} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, enabled: e.target.checked } }))} />
            Bank transfer
          </label>
          <div className="space-y-3">
            <Field label="Bank name">
              <Input value={draft.bank.bankName} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, bankName: e.target.value } }))} />
            </Field>
            <Field label="Account title">
              <Input value={draft.bank.accountTitle} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, accountTitle: e.target.value } }))} />
            </Field>
            <Field label="Account number">
              <Input value={draft.bank.accountNumber} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, accountNumber: e.target.value } }))} />
            </Field>
            <Field label="IBAN (optional)">
              <Input value={draft.bank.iban} onChange={(e) => setDraft((d) => ({ ...d, bank: { ...d.bank, iban: e.target.value } }))} />
            </Field>
          </div>
        </DashCard>

        <DashCard>
          <label className="mb-5 flex items-center gap-2 text-base font-semibold text-ink">
            <input
              type="checkbox"
              checked={draft.easypaisa.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, easypaisa: { ...d.easypaisa, enabled: e.target.checked } }))}
            />
            Easypaisa
          </label>
          <div className="space-y-3">
            <Field label="Account title">
              <Input
                value={draft.easypaisa.accountTitle}
                onChange={(e) => setDraft((d) => ({ ...d, easypaisa: { ...d.easypaisa, accountTitle: e.target.value } }))}
              />
            </Field>
            <Field label="Number">
              <Input value={draft.easypaisa.number} onChange={(e) => setDraft((d) => ({ ...d, easypaisa: { ...d.easypaisa, number: e.target.value } }))} />
            </Field>
          </div>
        </DashCard>

        <DashCard>
          <label className="mb-5 flex items-center gap-2 text-base font-semibold text-ink">
            <input
              type="checkbox"
              checked={draft.jazzcash.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, jazzcash: { ...d.jazzcash, enabled: e.target.checked } }))}
            />
            JazzCash
          </label>
          <div className="space-y-3">
            <Field label="Account title">
              <Input
                value={draft.jazzcash.accountTitle}
                onChange={(e) => setDraft((d) => ({ ...d, jazzcash: { ...d.jazzcash, accountTitle: e.target.value } }))}
              />
            </Field>
            <Field label="Number">
              <Input value={draft.jazzcash.number} onChange={(e) => setDraft((d) => ({ ...d, jazzcash: { ...d.jazzcash, number: e.target.value } }))} />
            </Field>
          </div>
        </DashCard>

        <Button loading={saving} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
