"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

interface QueuedProduct {
  id: string;
  title: string;
  description: string | null;
  moderationNotes: string | null;
  sourceType: "self" | "supplier";
  store: { name: string; slug: string } | null;
}

/**
 * Phase 6d (Admin Terminal re-skin) - SRS §4/FR-27.6's moderation queue,
 * restyled onto DashCard. Every action preserved: per-row approve/reject
 * with notes, bulk approve/reject (real per-item succeeded/failed), and
 * the force-remove/restore-any-product lookup (FR-54.2). Switched from
 * hand-rolled fetch to adminApi.
 */
export default function AdminModerationPage() {
  const confirm = useConfirm();
  const [queue, setQueue] = useState<QueuedProduct[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNotes, setBulkNotes] = useState("");
  const [lookupProductId, setLookupProductId] = useState("");
  const [lookupNotes, setLookupNotes] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  function load() {
    adminApi
      .get<QueuedProduct[]>("/admin/moderation/queue")
      .then(setQueue)
      .catch(() => setQueue([]));
  }

  useEffect(load, []);

  async function decide(productId: string, decision: "approve" | "reject") {
    setError(null);
    try {
      await adminApi.post(`/admin/moderation/queue/${productId}/${decision}`, { notes: notes[productId] ?? "" });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't record that decision.");
    }
  }

  function toggleSelected(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  /** SRS FR-8.17 (Module 89) - one bulk-decide request instead of a per-item Promise.all fan-out; the API reports a real per-item {succeeded, failed} shape. */
  async function decideSelected(decision: "approve" | "reject") {
    setError(null);
    if (decision === "reject" && !bulkNotes.trim()) {
      setError("A reason is required to reject (the field above) - it's shown to the seller.");
      return;
    }
    const ok = await confirm({
      title: `${decision === "approve" ? "Approve" : "Reject"} ${selected.size} product${selected.size === 1 ? "" : "s"}?`,
      description: decision === "reject" ? `Reason: ${bulkNotes}` : "This applies to every currently selected product in the queue.",
      confirmLabel: decision === "approve" ? "Approve selected" : "Reject selected",
      tone: decision === "reject" ? "danger" : "default",
    });
    if (!ok) return;
    try {
      const body = await adminApi.post<{ failed?: string[] }>("/admin/moderation/queue/bulk-decide", {
        productIds: [...selected],
        decision,
        notes: bulkNotes || undefined,
      });
      if (body.failed?.length) {
        setError(
          `${body.failed.length} of ${selected.size} product${selected.size === 1 ? "" : "s"} couldn't be ${decision === "approve" ? "approved" : "rejected"} - check the queue below.`,
        );
      }
    } catch {
      setError(`Some products couldn't be ${decision === "approve" ? "approved" : "rejected"}.`);
    }
    setSelected(new Set());
    setBulkNotes("");
    load();
  }

  /**
   * Module 37 (SRS §5.54/FR-54.2) - unlike the queue above (pending
   * products only), this reaches ANY product by id regardless of its
   * current moderation status - the queue list has no concept of
   * "already approved" products to click through to, so a direct
   * id lookup is the minimal real action surface (no new product-detail
   * page, consistent with this page's own "bare view" discipline).
   */
  async function forceRemoveOrRestore(action: "remove" | "restore") {
    if (!lookupProductId.trim()) {
      setLookupResult("Enter a product id first.");
      return;
    }
    if (action === "remove") {
      const ok = await confirm({
        title: `Force remove product ${lookupProductId.trim()}?`,
        description: `This is an instant takedown regardless of the product's current moderation status. Notes: ${lookupNotes || "(none)"}`,
        confirmLabel: "Remove",
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      const body = await adminApi.post<{ moderationStatus: string }>(`/admin/products/${lookupProductId.trim()}/${action}`, { notes: lookupNotes });
      setLookupResult(`Product ${lookupProductId.trim()} is now: ${body.moderationStatus}`);
    } catch (err) {
      setLookupResult(err instanceof AdminApiError ? err.message : `Couldn't ${action} that product.`);
    }
  }

  if (!queue) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Moderation queue" description="Listings flagged for prohibited/counterfeit content or restricted keywords, awaiting review." />

      {error && <Alert tone="danger">{error}</Alert>}

      <DashCard className="mb-4 max-w-2xl">
        <DashCardHeader
          title="Force remove / restore a product"
          description="Instant takedown for a product in ANY moderation status (not just this queue) - SRS §5.54/FR-54.2. Also how a supplier-listed product (source: supplier, see the queue below) can be taken down directly."
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Field label="Product id">
              <Input value={lookupProductId} onChange={(e) => setLookupProductId(e.target.value)} placeholder="uuid" />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Notes">
              <Input value={lookupNotes} onChange={(e) => setLookupNotes(e.target.value)} />
            </Field>
          </div>
          <Button variant="danger" onClick={() => forceRemoveOrRestore("remove")}>
            Remove
          </Button>
          <Button variant="secondary" onClick={() => forceRemoveOrRestore("restore")}>
            Restore
          </Button>
        </div>
        {lookupResult && <p className="mt-2 text-sm text-ink-muted">{lookupResult}</p>}
      </DashCard>

      {queue.length === 0 ? (
        <DashCard>
          <EmptyState title="The queue is empty" description="Flagged listings will show up here." />
        </DashCard>
      ) : (
        <DashCard>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <Field label="Notes for bulk action">
                <Input value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} placeholder="Reviewer notes" />
              </Field>
            </div>
            <Button disabled={selected.size === 0} onClick={() => decideSelected("approve")}>
              Approve selected ({selected.size})
            </Button>
            <Button variant="danger" disabled={selected.size === 0} onClick={() => decideSelected("reject")}>
              Reject selected ({selected.size})
            </Button>
          </div>
          <div className="divide-y divide-border">
            {queue.map((product) => (
              <div key={product.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={`Select ${product.title}`}
                    checked={selected.has(product.id)}
                    onCheckedChange={() => toggleSelected(product.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {product.title} <Badge tone={product.sourceType === "supplier" ? "info" : "neutral"}>{product.sourceType === "supplier" ? "Supplier-listed" : "Self"}</Badge>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {product.store?.name ?? "-"} {product.description && `· ${product.description}`}
                    </p>
                  </div>
                </div>
                <div className="ml-8 flex flex-wrap items-center gap-2">
                  <Input
                    className="h-8 w-56"
                    value={notes[product.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [product.id]: e.target.value })}
                    placeholder="Reviewer notes"
                  />
                  <Button variant="secondary" size="sm" onClick={() => decide(product.id, "approve")}>
                    Approve
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => decide(product.id, "reject")}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DashCard>
      )}
    </div>
  );
}
