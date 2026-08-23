"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";

/**
 * UI/UX Design Phase 4 - the seller dashboard's own instance of the same
 * "confirm before proceeding" primitive FR-8.16 built for the admin
 * terminal (`components/admin/ConfirmDialogProvider.tsx`). Same behavior
 * and Dialog primitive, deliberately a separate provider tree rather than
 * a shared import: the two sections mount their own provider at their own
 * layout root (same pattern this repo already uses for Toaster vs a
 * per-section provider), and admin's copy is mid-Phase-6-pending re-skin -
 * this one is free to evolve with the dashboard's own design pass without
 * coupling the two.
 */

export interface ConfirmValueChange {
  label: string;
  from: string;
  to: string;
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  changes?: ConfirmValueChange[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

type PendingRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  function settle(confirmed: boolean) {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent>
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

              <DialogFooter>
                <Button variant="secondary" onClick={() => settle(false)}>
                  {pending.cancelLabel ?? "Cancel"}
                </Button>
                <Button variant={pending.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
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
  if (!ctx) throw new Error("useConfirm() must be called under <ConfirmDialogProvider> (mounted in stores/[storeId]/layout.tsx).");
  return ctx;
}
