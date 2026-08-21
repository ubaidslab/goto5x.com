"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";

/**
 * FR-8.16 (v0.40) - the shared "confirm before proceeding" primitive every
 * admin destructive/money-moving action now uses, replacing the platform's
 * prior state (exactly one real confirm gate anywhere - a native
 * window.confirm() on the Settings Registry editor's high-impact-key save -
 * with every other action, including seller ban, plan retire, and sending a
 * newsletter to every seller, firing with zero confirmation). Built once
 * here, imported everywhere - not copy-pasted per page (the founder's
 * explicit requirement) - on top of the existing Radix-based Dialog
 * component (`components/ui/Dialog.tsx`), the same primitive the seller
 * dashboard already uses, so this is a real, shared mechanism rather than a
 * second modal system. Styling stays exactly Dialog.tsx's current default -
 * intentionally minimal at this checkpoint (this FR is a safety-mechanism
 * fix, not part of the UI/UX Design Phase); Phase 6's admin-terminal re-skin
 * restyles it like every other admin primitive, without touching its
 * behavior.
 */

export interface ConfirmValueChange {
  /** e.g. "Wallet balance", "Commission rate" */
  label: string;
  from: string;
  to: string;
}

export interface ConfirmOptions {
  /** Plain-language summary of what's about to happen. */
  title: string;
  /** One or two sentences of further plain-language detail. */
  description?: string;
  /** Old value -> new value rows, for money/value-changing actions (mirrors the Settings Registry high-impact-key pattern this FR generalizes). */
  changes?: ConfirmValueChange[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" red-styles the confirm button - use for anything irreversible or platform-wide. */
  tone?: "default" | "danger";
  /**
   * When set, the confirm button stays disabled until the admin types this
   * exact string into a text field - the strongest variant, reserved for
   * the single highest-blast-radius action in the terminal (sending a
   * newsletter to every seller) per the founder's explicit instruction.
   */
  typedConfirmation?: string;
}

type PendingRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [typedValue, setTypedValue] = useState("");
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setTypedValue("");
      setPending({ ...options, resolve });
    });
  }, []);

  function settle(confirmed: boolean) {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPending(null);
  }

  const typedMismatch = !!pending?.typedConfirmation && typedValue !== pending.typedConfirmation;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent onEscapeKeyDown={(e) => pending?.typedConfirmation && e.preventDefault()}>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>{pending.title}</DialogTitle>
                {pending.description && <DialogDescription>{pending.description}</DialogDescription>}
              </DialogHeader>

              {pending.changes && pending.changes.length > 0 && (
                <div className="my-2 space-y-2 rounded-md border border-border bg-canvas p-3">
                  {pending.changes.map((c) => (
                    <div key={c.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-muted">{c.label}</span>
                      <span className="font-medium text-ink">
                        {c.from} <span className="text-ink-faint">&rarr;</span> {c.to}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {pending.typedConfirmation && (
                <div className="my-2">
                  <label className="mb-1.5 block text-sm text-ink-muted">
                    Type <span className="font-mono font-semibold text-ink">{pending.typedConfirmation}</span> to confirm
                  </label>
                  <input
                    autoFocus
                    value={typedValue}
                    onChange={(e) => setTypedValue(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="secondary" onClick={() => settle(false)}>
                  {pending.cancelLabel ?? "Cancel"}
                </Button>
                <Button variant={pending.tone === "danger" ? "danger" : "primary"} disabled={typedMismatch} onClick={() => settle(true)}>
                  {pending.confirmLabel ?? "Confirm"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** `const confirm = useConfirm(); const ok = await confirm({...}); if (!ok) return;` */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() must be called under <ConfirmDialogProvider> (mounted in admin/layout.tsx).");
  return ctx;
}
